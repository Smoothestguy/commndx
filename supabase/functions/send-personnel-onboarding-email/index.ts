import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ctaButton, preheader, stripHtmlToText } from "../_shared/applicant-email.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OnboardingEmailRequest {
  personnelId: string;
  email: string;
  firstName: string;
  lastName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { personnelId, email, firstName, lastName }: OnboardingEmailRequest = await req.json();

    console.log("[Onboarding Email] Received request for personnel:", personnelId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 21);

    const { error: tokenError } = await supabase
      .from("personnel_onboarding_tokens")
      .insert({
        personnel_id: personnelId,
        token: token,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error("[Onboarding Email] Error creating token:", tokenError);
      throw tokenError;
    }

    const siteUrl = (Deno.env.get("SITE_URL") || "https://fairfieldrg.com").trim();
    const onboardingUrl = encodeURI(`${siteUrl}/onboard/${token}`);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background:#ffffff;">
  ${preheader("Complete your Fairfield onboarding — takes about 10 minutes.")}
  <div style="background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
    <h1 style="color:#1d4ed8; margin:0 0 16px; font-size:22px;">Your Fairfield onboarding link</h1>
    <p style="font-size: 16px;">Hi ${firstName},</p>
    <p>Your application has been approved. To complete your onboarding with Fairfield, please provide the following documentation.</p>
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #1e40af; font-size:15px;">Required Information</h3>
      <ul style="margin: 0; padding-left: 20px;">
        <li style="margin-bottom: 6px;">Social Security Number &amp; card</li>
        <li style="margin-bottom: 6px;">Work authorization documents</li>
        <li style="margin-bottom: 6px;">Emergency contact information</li>
        <li style="margin-bottom: 6px;">Address &amp; contact details</li>
      </ul>
    </div>
    ${ctaButton(onboardingUrl, "Start Onboarding →")}
    <p style="color: #6b7280; font-size: 14px;">This link is valid for 21 days. If you have questions, reply to this email.</p>
  </div>
</body>
</html>`;

    const text = `Hi ${firstName},

Your application has been approved. Please complete your Fairfield onboarding here:

${onboardingUrl}

Required information:
- Social Security Number and card
- Work authorization documents
- Emergency contact information
- Address and contact details

This link is valid for 21 days. Reply to this email if you have questions.`;

    const emailResponse = await resend.emails.send({
      from: "Fairfield <admin@fairfieldrg.com>",
      to: [email],
      reply_to: "admin@fairfieldrg.com",
      subject: "Your Fairfield onboarding link — action needed",
      html,
      text,
    });

    if (emailResponse.error) {
      console.error("[Onboarding Email] Resend error:", emailResponse.error);
      throw new Error(`Email sending failed: ${emailResponse.error.message}`);
    }

    console.log("[Onboarding Email] Email sent, ID:", emailResponse.data?.id);

    try {
      await fetch(`${supabaseUrl}/functions/v1/create-admin-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          notification_type: "onboarding_email_sent",
          title: `Onboarding Email Sent: ${firstName} ${lastName}`,
          message: `Onboarding documentation link sent to ${email}. Link expires in 21 days.`,
          link_url: `/personnel/${personnelId}`,
          related_id: personnelId,
          metadata: {
            personnel_name: `${firstName} ${lastName}`,
            personnel_email: email,
            token_expires: expiresAt.toISOString(),
          },
        }),
      });
    } catch (notifError) {
      console.error("[Onboarding Email] Failed to send admin notification:", notifError);
    }

    return new Response(
      JSON.stringify({ success: true, token, emailId: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Onboarding Email] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

// stripHtmlToText imported for potential reuse
void stripHtmlToText;

serve(handler);
