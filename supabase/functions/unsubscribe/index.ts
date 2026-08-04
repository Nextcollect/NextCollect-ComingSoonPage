import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * One-click unsubscribe (RFC 8058).
 *
 * DEPLOY WITH JWT VERIFICATION OFF:
 *   supabase functions deploy unsubscribe --no-verify-jwt
 * Mail clients and the one-click POST carry no Supabase JWT. The HMAC token IS the
 * authentication — it is the only thing proving the caller holds a link we issued.
 *
 * The token is an HMAC of the address, never the address alone. A guessable or
 * plaintext link would let anyone unsubscribe anyone, and would leak membership —
 * the same enumeration failure D-001 exists to prevent.
 *
 * Requires secret UNSUBSCRIBE_SECRET (see docs/EXECUTION.md).
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const enc = new TextEncoder();

async function expectedToken(email: string): Promise<string> {
  const secret = Deno.env.get("UNSUBSCRIBE_SECRET");
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET not configured");
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(email.toLowerCase()));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare so the token cannot be recovered by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The result page is served by the Next app on www.nxtcollect.com, NOT from here.
 *
 * WHY: the Supabase edge gateway rewrites any HTML response to `content-type: text/plain`
 * and adds `content-security-policy: sandbox` + `nosniff`. Verified 2026-08-03 — a
 * Cache-Control header set alongside it survived, so this is a deliberate platform control,
 * not a missing header. Two consequences for a user clicking unsubscribe:
 *   1. the page renders as raw HTML source, and
 *   2. with no charset, UTF-8 is decoded as latin-1, so "You’ve" became "Youâ€™ve" —
 *      which would have wrecked all four accented languages, not just the apostrophe.
 * Someone who thinks unsubscribe is broken presses the spam button instead, which is the
 * exact outcome D3 exists to prevent.
 *
 * Redirecting also puts the user on the brand domain rather than a *.supabase.co URL.
 * JSON responses are unaffected by the override, so the signup function needs no change.
 */
const RESULT_PAGE = "https://www.nxtcollect.com/unsubscribed";

const SUPPORTED_LOCALES = ["en", "nl", "de", "fr", "es", "it"];

const redirect = (status: "ok" | "invalid" | "error", lang: string) =>
  new Response(null, {
    status: 303, // See Other: forces GET on the result page regardless of this request's method
    headers: {
      Location: `${RESULT_PAGE}?status=${status}&lang=${SUPPORTED_LOCALES.includes(lang) ? lang : "en"}`,
      "Cache-Control": "no-store",
    },
  });

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("e") ?? "";
    const token = url.searchParams.get("t") ?? "";

    let email = "";
    try {
      email = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    } catch {
      email = "";
    }

    if (!email || !token || !safeEqual(token, await expectedToken(email))) {
      // Same outcome whether the address is unknown or the token is wrong — distinguishing
      // them would confirm membership. English, because a bad token means no locale lookup
      // can be trusted either.
      if (req.method === "POST") return new Response(null, { status: 400 });
      return redirect("invalid", "en");
    }

    // Locale captured at signup, so the result page speaks their language.
    const { data: row } = await supabase
      .from("nextcollect_registration_records")
      .select("locale")
      .eq("email", email)
      .maybeSingle();

    const lang = row?.locale ?? "en";

    const { error } = await supabase
      .from("nextcollect_registration_records")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("email", email)
      .is("unsubscribed_at", null);

    if (error) {
      console.error("Unsubscribe failed:", error);
      if (req.method === "POST") return new Response(null, { status: 500 });
      return redirect("error", lang);
    }

    // RFC 8058: the one-click POST expects a bare 200, never a redirect.
    if (req.method === "POST") return new Response(null, { status: 200 });

    // Idempotent: a valid token always reports success, whether or not this request changed
    // anything. "You weren't subscribed" would be an unnecessary membership signal.
    return redirect("ok", lang);
  } catch (err) {
    console.error("Error in unsubscribe:", err);
    if (req.method === "POST") return new Response(null, { status: 500 });
    return redirect("error", "en");
  }
});
