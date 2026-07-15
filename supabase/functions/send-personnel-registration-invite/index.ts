import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { ctaButton, preheader } from "../_shared/applicant-email.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  firstName?: string;
  lastName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, firstName, lastName }: InviteRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating registration invite for ${email}`);

    // Create invite record
    const { data: invite, error: insertError } = await supabaseClient
      .from("personnel_registration_invites")
      .insert({
        email,
        first_name: firstName || null,
        last_name: lastName || null,
        invited_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating invite:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company settings for branding
    const { data: companySettings } = await supabaseClient
      .from("company_settings")
      .select("company_name")
      .single();

    const companyName = companySettings?.company_name || "Our Company";
    const siteUrl = Deno.env.get("SITE_URL") || "https://lovable.dev";
    const registrationUrl = `${siteUrl}/register/${invite.token}`;

    const recipientName = firstName ? firstName : "there";

    // Send email
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background:#ffffff;">
  ${preheader("Complete your Fairfield onboarding — takes about 10 minutes.")}
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px;">
    <h1 style="color:#1d4ed8; margin:0 0 16px; font-size:22px;">Complete your ${companyName} registration</h1>
    <p style="font-size: 16px;">Hi ${recipientName},</p>
    <p>You've been invited to join our team. Please complete your registration using the button below.</p>
    ${ctaButton(registrationUrl, "Complete Registration →")}
    <p style="font-size: 14px; color: #6b7280;">During registration, you'll provide:</p>
    <ul style="font-size: 14px; color: #6b7280; padding-left:20px;">
      <li>Personal information</li>
      <li>Profile photo</li>
      <li>Work authorization details</li>
      <li>Emergency contact information</li>
    </ul>
    <p style="font-size: 14px; color: #6b7280;">This invitation is valid for 7 days.</p>
  </div>
</body>
</html>`;

    const text = `Hi ${recipientName},

You've been invited to join ${companyName}. Complete your registration here:

${registrationUrl}

During registration, you'll provide personal information, a profile photo, work authorization details, and emergency contact information.

This invitation is valid for 7 days.`;

    const emailResponse = await resend.emails.send({
      from: "Fairfield <admin@fairfieldrg.com>",
      to: [email],
      reply_to: "admin@fairfieldrg.com",
      subject: `Complete your ${companyName} registration — action needed`,
      html,
      text,
    });

    if (emailResponse.error) {
      console.error("Email failed to send:", emailResponse.error);
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, invite }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-personnel-registration-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
