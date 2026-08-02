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

const PAGE = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#F2F0EB;color:#1C1B29;font:16px/1.6 system-ui,-apple-system,sans-serif;padding:24px}
  main{max-width:34rem;text-align:center}
  h1{font-size:1.5rem;margin:0 0 .5rem}
  a{color:#470FF4}
</style></head>
<body><main><h1>${title}</h1><p>${body}</p>
<p><a href="https://www.nxtcollect.com">Return to NextCollect</a></p></main></body></html>`;

const html = (status: number, title: string, body: string) =>
  new Response(PAGE(title, body), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
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
      // Deliberately identical wording whether the address is unknown or the token is
      // wrong — distinguishing them would confirm membership.
      return html(400, "This link isn’t valid", "The unsubscribe link is invalid or has expired.");
    }

    const { error } = await supabase
      .from("nextcollect_registration_records")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("email", email)
      .is("unsubscribed_at", null);

    if (error) {
      console.error("Unsubscribe failed:", error);
      return html(503, "Something went wrong", "Please try again shortly, or email support@nxtcollect.com.");
    }

    // RFC 8058: the one-click POST expects a 200 and no interactive content.
    if (req.method === "POST") {
      return new Response(null, { status: 200 });
    }

    return html(
      200,
      "You’ve been unsubscribed",
      "You won’t receive further emails from NextCollect. If this was a mistake, you can sign up again at any time.",
    );
  } catch (err) {
    console.error("Error in unsubscribe:", err);
    return html(500, "Something went wrong", "Please try again shortly.");
  }
});
