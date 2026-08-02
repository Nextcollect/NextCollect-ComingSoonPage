import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"; // Issue #3

const ALLOWED_ORIGINS = [
  "https://www.nxtcollect.com",
  "https://nxtcollect.com",
  // Include localhost only when explicitly enabled (set ALLOW_LOCAL_ORIGIN=true in local Supabase config)
  ...(Deno.env.get("ALLOW_LOCAL_ORIGIN") === "true" ? ["http://localhost:3000"] : []),
];

// Echo back the requesting origin when it's in the allowlist.
// Avoids sending "Access-Control-Allow-Origin: *" which would contradict the origin allowlist.
function getCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };
}

// Admin client so RLS doesn't interfere with the existence check
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface EmailRequest {
  email: string;
  registrationPosition?: number;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // Issue #2: parse body manually so we can validate registrationPosition at runtime
    const body = await req.json();
    const email: string = body.email;
    const rawPosition = body.registrationPosition;
    // Accept only positive integers — anything else (strings, floats, objects, HTML) is treated as absent
    const registrationPosition: number | null =
      Number.isInteger(rawPosition) && rawPosition > 0 ? (rawPosition as number) : null;

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Issue #3: verify the address is actually registered — prevents sending to arbitrary emails
    const { data: registration } = await supabase
      .from("nextcollect_registration_records")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!registration) {
      return new Response(
        JSON.stringify({ error: "Email not registered" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // NOTE: milestone thresholds are duplicated in app/components/Hero/index.jsx (getMilestoneText)
    const positionText = (() => {
      if (!registrationPosition) {
        return "You're now a Founder, which gives you priority access at launch and early updates on what we're building.";
      }

      const milestones = [100, 500, 1000, 2000, 3000, 5000, 10000];
      for (const threshold of milestones) {
        if (registrationPosition <= threshold) {
          return `You're now part of the first <strong style="color:#4b2dff;">${threshold}</strong> helping shape the platform. You're now a Founder, which gives you priority access at launch and early updates on what we're building.`;
        }
      }

      return `You're registrant #<strong style="color:#4b2dff;">${registrationPosition}</strong>. You're now a Founder, which gives you priority access at launch and early updates on what we're building.`;
    })();

    const emailBody = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to our platform</title>
</head>
<body style="margin:0; padding:0; width:100%; background-color:#ffffff;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:32px 16px 28px 16px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="640" style="max-width:624px; width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:0 8px 20px 8px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" valign="middle" style="padding:4px 0 6px 0;">
                    <a href="https://www.nxtcollect.com" style="text-decoration:none; display:inline-block;">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 627.04 63.83" width="170" style="display:block; max-width:190px; height:auto; border:0; outline:none; text-decoration:none;">
                        <g fill="#4b2dff">
                          <path d="M47.14,62.21h-12.13L11.3,20.97v41.24H0V4.16h12.72l23.12,40.53V4.16h11.3v58.05Z"/>
                          <path d="M98.86,36.85h-28.2v14.93h32.14v10.44h-43.99V4.16h42.58v10.28h-30.72v12.33h28.2v10.08Z"/>
                          <path d="M158.92,62.21h-14.73l-11.03-19.77-11.66,19.77h-14.1l18.67-29.58-17.76-28.48h14.49l10.36,18.87,10.63-18.87h14.02l-17.76,28,18.87,30.05Z"/>
                          <path d="M208.23,4.16v10.28h-17.37v47.77h-12.21V14.44h-17.45V4.16h47.03Z"/>
                          <path d="M256.28,57.88c-4.33,3.97-9.87,5.95-16.62,5.95-8.35,0-14.91-2.68-19.69-8.03-4.78-5.38-7.17-12.76-7.17-22.13,0-10.14,2.72-17.95,8.15-23.43,4.73-4.78,10.74-7.17,18.04-7.17,9.77,0,16.91,3.2,21.43,9.61,2.49,3.6,3.83,7.21,4.02,10.83h-12.13c-.79-2.78-1.8-4.88-3.03-6.3-2.21-2.52-5.47-3.78-9.81-3.78s-7.89,1.78-10.44,5.34c-2.55,3.56-3.82,8.59-3.82,15.1s1.34,11.39,4.04,14.63c2.69,3.24,6.11,4.86,10.26,4.86s7.5-1.39,9.73-4.17c1.23-1.5,2.26-3.74,3.07-6.73h12.01c-1.05,6.33-3.73,11.47-8.04,15.44Z"/>
                          <path d="M299.25,63.83c-8.3,0-14.64-2.26-19.02-6.77-5.88-5.54-8.82-13.52-8.82-23.95s2.94-18.62,8.82-23.95c4.38-4.52,10.73-6.77,19.02-6.77s14.64,2.26,19.02,6.77c5.85,5.33,8.78,13.31,8.78,23.95s-2.93,18.41-8.78,23.95c-4.39,4.52-10.73,6.77-19.02,6.77ZM310.71,48.23c2.81-3.54,4.21-8.59,4.21-15.12s-1.41-11.55-4.23-15.1c-2.82-3.56-6.64-5.34-11.44-5.34s-8.64,1.77-11.5,5.32c-2.86,3.54-4.29,8.59-4.29,15.12s1.43,11.58,4.29,15.12c2.86,3.54,6.7,5.32,11.5,5.32s8.62-1.77,11.46-5.32Z"/>
                          <path d="M336.32,4.16h12.13v47.62h28.75v10.44h-40.88V4.16Z"/>
                          <path d="M385.59,4.16h12.13v47.62h28.75v10.44h-40.88V4.16Z"/>
                          <path d="M475.27,36.85h-28.2v14.93h32.14v10.44h-43.99V4.16h42.58v10.28h-30.72v12.33h28.2v10.08Z"/>
                          <path d="M529.62,57.88c-4.33,3.97-9.87,5.95-16.62,5.95-8.35,0-14.91-2.68-19.69-8.03-4.78-5.38-7.17-12.76-7.17-22.13,0-10.14,2.72-17.95,8.15-23.43,4.73-4.78,10.74-7.17,18.04-7.17,9.77,0,16.91,3.2,21.43,9.61,2.49,3.6,3.83,7.21,4.02,10.83h-12.13c-.79-2.78-1.8-4.88-3.03-6.3-2.21-2.52-5.47-3.78-9.81-3.78s-7.89,1.78-10.44,5.34c-2.55,3.56-3.82,8.59-3.82,15.1s1.34,11.39,4.04,14.63c2.69,3.24,6.11,4.86,10.26,4.86s7.5-1.39,9.73-4.17c1.23-1.5,2.26-3.74,3.07-6.73h12.01c-1.05,6.33-3.73,11.47-8.04,15.44Z"/>
                          <path d="M589.09,4.16v10.28h-17.37v47.77h-12.21V14.44h-17.45V4.16h47.03Z"/>
                          <path d="M624,3.04c2.03,2.03,3.04,4.47,3.04,7.33s-1.04,5.43-3.11,7.45c-2.02,1.95-4.44,2.93-7.26,2.93s-5.38-1-7.38-3-3-4.46-3-7.38,1.08-5.55,3.24-7.56c2.03-1.88,4.41-2.81,7.14-2.81s5.31,1.01,7.33,3.04ZM616.67,1.77c-2.38,0-4.42.86-6.09,2.59-1.65,1.69-2.48,3.69-2.48,6.01s.84,4.44,2.52,6.12c1.67,1.68,3.69,2.52,6.05,2.52s4.37-.84,6.04-2.53c1.67-1.7,2.5-3.73,2.5-6.11s-.83-4.31-2.49-6.01c-1.68-1.73-3.7-2.59-6.05-2.59ZM615.14,12.08v4.07h-3.01V4.64h3.2c1.42,0,2.21.01,2.37.02.91.07,1.67.26,2.27.59,1.02.56,1.53,1.48,1.53,2.75,0,.97-.27,1.67-.81,2.1-.54.43-1.2.69-1.99.77.72.15,1.27.37,1.63.66.68.54,1.01,1.4,1.01,2.58v1.03c0,.11,0,.23.02.34.01.11.04.22.08.34l.1.32h-2.87c-.09-.37-.15-.9-.18-1.59s-.09-1.16-.18-1.41c-.15-.4-.43-.68-.84-.84-.23-.09-.57-.16-1.03-.18l-1.29-.08ZM616.31,10.01c.7,0,1.25-.14,1.65-.42.39-.28.59-.74.59-1.37s-.31-1.07-.93-1.31c-.41-.16-.99-.24-1.75-.24h-1.9v3.34h2.33Z"/>
                        </g>
                      </svg>
                    </a>
                  </td>
                  <td align="right" valign="middle">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-left:18px;">
                          <a href="https://www.instagram.com/nextcollect" style="text-decoration:none;">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" style="display:block; border:0; outline:none; text-decoration:none;">
                              <path fill="#4b2dff" d="M4.7,0c-.9,0-1.4.2-1.9.4-.5.2-1,.5-1.4.9-.4.4-.7.9-.9,1.4-.2.5-.3,1.1-.4,1.9C0,5.6,0,5.8,0,8c0,2.2,0,2.4,0,3.3,0,.9.2,1.4.4,1.9.2.5.5,1,.9,1.4.4.4.9.7,1.4.9.5.2,1.1.3,1.9.4.9,0,1.1,0,3.3,0,2.2,0,2.4,0,3.3,0,.9,0,1.4-.2,1.9-.4.5-.2,1-.5,1.4-.9.4-.4.7-.9.9-1.4.2-.5.3-1.1.4-1.9,0-.9,0-1.1,0-3.3,0-2.2,0-2.4,0-3.3,0-.9-.2-1.4-.4-1.9-.2-.5-.5-1-.9-1.4-.4-.4-.9-.7-1.4-.9-.5-.2-1.1-.3-1.9-.4C10.4,0,10.2,0,8,0c-2.2,0-2.4,0-3.3,0ZM4.8,14.5c-.8,0-1.2-.2-1.5-.3-.3-.1-.7-.3-.9-.6-.3-.3-.5-.6-.6-.9-.1-.3-.2-.7-.3-1.5,0-.8,0-1.1,0-3.2,0-2.1,0-2.4,0-3.2,0-.8.2-1.2.3-1.5.1-.4.3-.6.6-.9.3-.3.6-.5.9-.6.3-.1.7-.2,1.5-.3.8,0,1.1,0,3.2,0,2.1,0,2.4,0,3.2,0,.8,0,1.2.2,1.5.3.4.1.6.3.9.6.3.3.5.5.6.9.1.3.2.7.3,1.5,0,.8,0,1.1,0,3.2,0,2.1,0,2.4,0,3.2,0,.8-.2,1.2-.3,1.5-.1.4-.3.6-.6.9-.3.3-.6.5-.9.6-.3.1-.7.2-1.5.3-.8,0-1.1,0-3.2,0-2.1,0-2.4,0-3.2,0ZM11.3,3.7c0,.2,0,.4.2.5.1.2.3.3.4.4.2,0,.4,0,.6,0,.2,0,.4-.1.5-.3.1-.1.2-.3.3-.5,0-.2,0-.4,0-.6,0-.2-.2-.3-.4-.4-.2-.1-.3-.2-.5-.2-.3,0-.5.1-.7.3-.2.2-.3.4-.3.7ZM3.9,8c0,1.1.4,2.1,1.2,2.9.8.8,1.8,1.2,2.9,1.2,1.1,0,2.1-.4,2.9-1.2.8-.8,1.2-1.8,1.2-2.9,0-1.1-.5-2.1-1.2-2.9-.8-.8-1.8-1.2-2.9-1.2-1.1,0-2.1.4-2.9,1.2-.8.8-1.2,1.8-1.2,2.9ZM5.3,8c0-.5.2-1,.4-1.5.3-.4.7-.8,1.2-1,.5-.2,1-.3,1.5-.2.5.1,1,.4,1.4.7.4.4.6.8.7,1.4.1.5,0,1.1-.1,1.5-.2.5-.5.9-1,1.2-.4.3-1,.5-1.5.5-.4,0-.7,0-1-.2-.3-.1-.6-.3-.9-.6-.2-.2-.4-.5-.6-.9-.1-.3-.2-.7-.2-1Z"/>
                            </svg>
                          </a>
                        </td>
                        <td style="padding-left:18px;">
                          <a href="https://www.facebook.com/people/nextcollect/61582427723720/" style="text-decoration:none;">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" style="display:block; border:0; outline:none; text-decoration:none;">
                              <path fill="#4b2dff" d="M6.1,15.8v-5.3h-1.6v-2.4h1.6v-1.1c0-2.7,1.2-4,3.9-4s.6,0,1,0c.3,0,.5,0,.8.1v2.2c-.1,0-.3,0-.4,0-.2,0-.3,0-.5,0-.5,0-.8,0-1.1.2-.2,0-.3.2-.5.4-.2.3-.2.7-.2,1.2v.9h2.6l-.3,1.4-.2,1h-2.2v5.5c4-.5,7-3.9,7-7.9S12.4,0,8,0,0,3.6,0,8s2.6,6.9,6.1,7.8Z"/>
                            </svg>
                          </a>
                        </td>
                        <td style="padding-left:18px;">
                          <a href="https://www.tiktok.com/@nextcollect" style="text-decoration:none;">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" style="display:block; border:0; outline:none; text-decoration:none;">
                              <path fill="#4b2dff" d="M12,2.5c-.6-.7-.9-1.6-.9-2.5h-2.7v11c0,.6-.3,1.2-.7,1.6-.4.4-1,.6-1.6.6-1.3,0-2.3-1-2.3-2.3s1.5-2.7,3-2.2v-2.8c-3.1-.4-5.7,2-5.7,5s2.4,5,5,5,5-2.3,5-5v-5.6c1.1.8,2.4,1.2,3.8,1.2v-2.7s-1.7,0-2.9-1.3Z"/>
                            </svg>
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Main card -->
          <tr>
            <td style="padding:0 8px 32px 8px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff; border-radius:0;">
                <tr>
                  <td style="padding:32px 0px 48px 0px;" align="center">
                    <img src="https://www.nxtcollect.com/img/Test_on_the_list_v03.png" alt="You're on the list!" width="600" style="display:block; width:100%; max-width:600px; height:auto; border:0; outline:none; text-decoration:none;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0px 8px 0px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td valign="middle" width="52" style="padding-right:12px; padding-bottom: 10px;">
                          <img src="https://www.nxtcollect.com/img/Nextcollect_Welcomes_Email_Profile-Images_v03.png" alt="Team NextCollect" width="125" style="display:block; width:125px; height:auto; outline:none; text-decoration:none;" />
                        </td>
                      </tr>
                      <tr>
                        <td valign="middle" align="left">
                          <p style="margin:0; font-family:'inter', Arial, sans-serif; font-size:17px; font-weight:600; line-height:1.4; color:#1C1B29;"> Team Nextcollect</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 0px 26px 0px;" align="left">
                    <p style="margin:0 0 16px 0; font-family:'inter', Arial, sans-serif; font-size:17px; font-weight:400; line-height:1.7; color:#1C1B29;">
                      Hi there,<br /><br />
                      Thanks for signing up for Nextcollect and contributing to the upcoming platform. ${positionText}
                    </p>
                    <p style="margin:0; font-family:'inter', Arial, sans-serif; font-size:17px; font-weight:400; line-height:1.7; color:#1C1B29;">
                      Thanks for joining us this early,<br /><br />
                      Matthijs & Rens
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px 0px 44px 0px;" align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:0 8px 14px 8px;">
                          <p style="margin:0; font-family:'inter', Arial, sans-serif; font-size:17px; font-weight:700; line-height:1.4; color:#4b2dff;">
                            Want to meet other early members?
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:0 8px;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" width="360" style="width:100%; max-width:360px; margin:0 auto; background-color:#4b2dff; border-radius:10px;">
                            <tr>
                              <td align="center" style="padding:14px 18px;">
                                <a href="https://chat.whatsapp.com/EngLN5KIIB7CitR2xkzaMv" target="_blank" style="display:block; color:#ffffff; text-decoration:none; font-family:'inter', Arial, sans-serif; font-size:17px; font-weight:600; letter-spacing:0.4px; line-height:22px; text-align:center;">
                                  Join the Whatsapp founders group
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer note -->
          <tr>
            <td style="padding:0 0px 16px 0px;" align="center">
              <p style="margin:0; font-family:'inter', Arial, sans-serif; font-size:13px; font-weight:400; line-height:1.5; color:#4b2dff;">
                You are receiving this email because you have registered for our platform. Make sure our messages get to your inbox (and not your bulk or junk folders).
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 0px 24px 0px;" align="center">
              <p style="margin:0 0 6px 0; font-family:'inter', Arial, sans-serif; font-size:13px; font-weight:400; line-height:1.5; color:#4b2dff;">
                Copyright &copy; NEXTCOLLECT
              </p>
              <p style="margin:0; font-family:'inter', Arial, sans-serif; font-size:13px; font-weight:400; line-height:1.5; color:#4b2dff;">
                For questions reach at <a href="mailto:info@nxtcollect.com" style="color:#4b2dff; text-decoration:underline;">info@nxtcollect.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "matthijs.email@nxtcollect.com",
        to: email,
        subject: "Welcome to Nextcollect - You're on the Early Access List",
        html: emailBody,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      // Issue #4: log the upstream detail server-side; never return it to the client.
      // Also normalise the status so Resend's own codes aren't mirrored outward.
      console.error("Resend API error:", response.status, result);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        id: result.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Issue #4: exception detail stays in the logs, never in the response body.
    console.error("Error in send-confirmation-email:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
