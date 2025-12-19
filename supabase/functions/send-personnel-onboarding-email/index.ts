import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { personnelId, email, firstName, lastName }: OnboardingEmailRequest = await req.json();

    console.log("[Onboarding Email] Received request for personnel:", personnelId);

    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate a unique token and store it
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

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

    console.log("[Onboarding Email] Token created successfully");

    // Build onboarding URL
    const siteUrl = Deno.env.get("SITE_URL") || "https://your-app.lovable.app";
    const onboardingUrl = `${siteUrl}/onboard/${token}`;

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "Onboarding <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome! Complete Your Onboarding Documentation",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to the Team!</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px;">Hi ${firstName},</p>
            
            <p>Congratulations! Your application has been approved. To complete your onboarding, we need you to provide some additional documentation.</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0;">
              <h3 style="margin-top: 0; color: #1e40af;">Required Documents:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;"><strong>I-9 Employment Eligibility Verification</strong></li>
                <li style="margin-bottom: 8px;"><strong>Social Security Number</strong></li>
                <li style="margin-bottom: 8px;"><strong>W-9 / 1099 Tax Information</strong></li>
                <li style="margin-bottom: 8px;"><strong>Emergency Contact Information</strong></li>
                <li style="margin-bottom: 8px;"><strong>Direct Deposit Information</strong> (optional)</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${onboardingUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Complete Onboarding</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">This link will expire in 30 days. If you have any questions, please contact your supervisor.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${onboardingUrl}" style="color: #3b82f6;">${onboardingUrl}</a>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("[Onboarding Email] Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, token }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Onboarding Email] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
