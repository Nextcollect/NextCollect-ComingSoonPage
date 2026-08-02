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
 * Copy in all six supported locales. An English-only exit wall is friction, and friction
 * on an unsubscribe converts straight into spam complaints — the one thing this domain's
 * reputation cannot absorb. The locale is the one captured at signup.
 */
type Key = "done_title" | "done_body" | "bad_title" | "bad_body" | "err_title" | "err_body" | "back";
const COPY: Record<string, Record<Key, string>> = {
  en: {
    done_title: "You’ve been unsubscribed",
    done_body: "You won’t receive further emails from NextCollect. If this was a mistake, you can sign up again at any time.",
    bad_title: "This link isn’t valid",
    bad_body: "The unsubscribe link is invalid or has expired.",
    err_title: "Something went wrong",
    err_body: "Please try again shortly, or email info@nxtcollect.com.",
    back: "Return to NextCollect",
  },
  nl: {
    done_title: "Je bent uitgeschreven",
    done_body: "Je ontvangt geen e-mails meer van NextCollect. Was dit een vergissing? Je kunt je altijd opnieuw aanmelden.",
    bad_title: "Deze link is niet geldig",
    bad_body: "De afmeldlink is ongeldig of verlopen.",
    err_title: "Er ging iets mis",
    err_body: "Probeer het zo meteen opnieuw, of mail naar info@nxtcollect.com.",
    back: "Terug naar NextCollect",
  },
  de: {
    done_title: "Sie wurden abgemeldet",
    done_body: "Sie erhalten keine weiteren E-Mails von NextCollect. Falls dies ein Versehen war, können Sie sich jederzeit erneut anmelden.",
    bad_title: "Dieser Link ist ungültig",
    bad_body: "Der Abmeldelink ist ungültig oder abgelaufen.",
    err_title: "Etwas ist schiefgelaufen",
    err_body: "Bitte versuchen Sie es gleich noch einmal oder schreiben Sie an info@nxtcollect.com.",
    back: "Zurück zu NextCollect",
  },
  fr: {
    done_title: "Vous êtes désinscrit",
    done_body: "Vous ne recevrez plus d’e-mails de NextCollect. S’il s’agit d’une erreur, vous pouvez vous réinscrire à tout moment.",
    bad_title: "Ce lien n’est pas valide",
    bad_body: "Le lien de désinscription est invalide ou a expiré.",
    err_title: "Une erreur est survenue",
    err_body: "Veuillez réessayer dans un instant, ou écrivez à info@nxtcollect.com.",
    back: "Retour à NextCollect",
  },
  es: {
    done_title: "Te has dado de baja",
    done_body: "No recibirás más correos de NextCollect. Si ha sido un error, puedes volver a registrarte cuando quieras.",
    bad_title: "Este enlace no es válido",
    bad_body: "El enlace para darse de baja no es válido o ha caducado.",
    err_title: "Algo ha salido mal",
    err_body: "Vuelve a intentarlo en un momento o escribe a info@nxtcollect.com.",
    back: "Volver a NextCollect",
  },
  it: {
    done_title: "Iscrizione annullata",
    done_body: "Non riceverai più email da NextCollect. Se è stato un errore, puoi iscriverti di nuovo quando vuoi.",
    bad_title: "Questo link non è valido",
    bad_body: "Il link di annullamento non è valido o è scaduto.",
    err_title: "Qualcosa è andato storto",
    err_body: "Riprova tra poco oppure scrivi a info@nxtcollect.com.",
    back: "Torna a NextCollect",
  },
};

const copyFor = (loc: string) => COPY[loc] ?? COPY.en;

const PAGE = (lang: string, title: string, body: string, back: string) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"/>
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
<p><a href="https://www.nxtcollect.com">${back}</a></p></main></body></html>`;

const html = (status: number, lang: string, title: string, body: string, back: string) =>
  new Response(PAGE(lang, title, body, back), {
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
      // wrong — distinguishing them would confirm membership. English here because an
      // invalid token means we cannot trust any locale lookup either.
      const c = COPY.en;
      return html(400, "en", c.bad_title, c.bad_body, c.back);
    }

    // Read the locale captured at signup so the page speaks their language.
    const { data: row } = await supabase
      .from("nextcollect_registration_records")
      .select("locale")
      .eq("email", email)
      .maybeSingle();

    const lang = row?.locale && COPY[row.locale] ? row.locale : "en";
    const c = copyFor(lang);

    const { error } = await supabase
      .from("nextcollect_registration_records")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("email", email)
      .is("unsubscribed_at", null);

    if (error) {
      console.error("Unsubscribe failed:", error);
      return html(503, lang, c.err_title, c.err_body, c.back);
    }

    // RFC 8058: the one-click POST expects a 200 and no interactive content.
    if (req.method === "POST") {
      return new Response(null, { status: 200 });
    }

    // Idempotent by design: a valid token always shows "unsubscribed", whether this
    // request changed anything or the address was already opted out. Reporting "you
    // weren't subscribed" would be an unnecessary membership signal.
    return html(200, lang, c.done_title, c.done_body, c.back);
  } catch (err) {
    console.error("Error in unsubscribe:", err);
    const c = COPY.en;
    return html(500, "en", c.err_title, c.err_body, c.back);
  }
});
