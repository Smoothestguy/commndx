import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationEmailRequest {
  personnelId: string;
  personnelEmail: string;
  personnelName: string;
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SITE_URL = Deno.env.get("SITE_URL") || "https://app.example.com";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { personnelId, personnelEmail, personnelName } = await req.json() as ConfirmationEmailRequest;

    console.log("[Onboarding Confirmation] Sending confirmation email to:", personnelEmail);

    if (!personnelEmail) {
      throw new Error("Personnel email is required");
    }

    if (!RESEND_API_KEY) {
      console.error("[Onboarding Confirmation] RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    // Send confirmation email to personnel
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Fairfield Response Group <careers@fairfieldrg.com>",
        to: [personnelEmail],
        subject: "Onboarding Complete - Welcome to the Team!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb; margin-bottom: 24px;">Onboarding Complete!</h1>
            
            <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
              Dear ${personnelName},
            </p>
            
            <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
              Congratulations! You have successfully completed your onboarding process. We're excited to have you on our team!
            </p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
              <h3 style="color: #1f2937; margin-top: 0;">What's Next?</h3>
              <ul style="color: #4b5563; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Our HR team will review your submitted documents</li>
                <li style="margin-bottom: 8px;">You may be contacted if any additional information is needed</li>
                <li style="margin-bottom: 8px;">Your project manager will reach out with your assignment details</li>
              </ul>
            </div>
            
            <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
              If you have any questions, please don't hesitate to contact our HR department.
            </p>
            
            <p style="font-size: 16px; color: #374151; margin-bottom: 8px;">
              Welcome aboard!
            </p>
            
            <p style="font-size: 16px; color: #374151; font-weight: bold;">
              The HR Team
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("[Onboarding Confirmation] Failed to send email:", errorText);
      throw new Error(`Failed to send confirmation email: ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log("[Onboarding Confirmation] Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ success: true, message: "Confirmation email sent" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Onboarding Confirmation] Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
