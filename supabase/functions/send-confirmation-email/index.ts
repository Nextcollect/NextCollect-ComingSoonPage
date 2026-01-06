import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  email: string;
  registrationPosition?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, registrationPosition }: EmailRequest = await req.json();

    if (!email) {
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

    const positionText = registrationPosition
      ? `You are registrant #${registrationPosition}`
      : "";

    const emailBody = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
      h1 { color: #1a1a1a; margin: 0 0 10px 0; }
      .content { margin-bottom: 20px; }
      .footer { color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px; }
      .position { font-weight: bold; color: #0066cc; margin: 15px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>You're in the list!</h1>
      </div>
      <div class="content">
        <p>Thanks for joining our early access group. You'll be one of the founding members and get access before anyone else.</p>
        ${positionText ? `<p class="position">${positionText}</p>` : ""}
        <p>We'll notify you as soon as the product is live. Stay tuned!</p>
      </div>
      <div class="footer">
        <p>Next Collect - Europe's Trusted Platform for Collectors</p>
        <p>Email: info@nxtcollect.com</p>
      </div>
    </div>
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
        from: "noreply@nxtcollect.com",
        to: email,
        subject: "Welcome to Next Collect - You're on the Early Access List",
        html: emailBody,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", result);
      return new Response(
        JSON.stringify({
          error: "Failed to send email",
          details: result,
        }),
        {
          status: response.status,
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
    console.error("Error in send-confirmation-email:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});