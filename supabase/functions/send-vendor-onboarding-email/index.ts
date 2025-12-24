import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VendorOnboardingEmailRequest {
  vendorId: string;
  vendorName: string;
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Verify user is admin or manager
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !["admin", "manager"].includes(roleData.role)) {
      throw new Error("Only admins and managers can send vendor onboarding invitations");
    }

    const { vendorId, vendorName, email }: VendorOnboardingEmailRequest = await req.json();

    console.log("Creating onboarding token for vendor:", vendorId);

    // Create onboarding token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("vendor_onboarding_tokens")
      .insert({
        vendor_id: vendorId,
      })
      .select("token")
      .single();

    if (tokenError) {
      console.error("Error creating token:", tokenError);
      throw new Error("Failed to create onboarding token");
    }

    // Update vendor status to 'invited'
    await supabaseAdmin
      .from("vendors")
      .update({ onboarding_status: "invited" })
      .eq("id", vendorId);

    const siteUrl = Deno.env.get("SITE_URL") || "https://lovable.dev";
    const onboardingLink = `${siteUrl}/vendor-onboarding/${tokenData.token}`;

    console.log("Sending vendor onboarding invitation to:", email);
    console.log("Onboarding link:", onboardingLink);

    const emailResponse = await resend.emails.send({
      from: "Fairfield <admin@fairfieldrg.com>",
      to: [email],
      subject: "Complete Your Vendor Registration",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Complete Your Vendor Registration</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${vendorName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">You've been invited to complete your vendor registration. This process will help us set up your account and get you ready to work with us.</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">Please complete the following information:</p>
            
            <ul style="font-size: 16px; margin-bottom: 25px; padding-left: 20px;">
              <li style="margin-bottom: 10px;">🏢 <strong>Company Information</strong> - Business details and contact info</li>
              <li style="margin-bottom: 10px;">📍 <strong>Address</strong> - Your business address</li>
              <li style="margin-bottom: 10px;">📄 <strong>W-9 Tax Form</strong> - Required for tax reporting</li>
              <li style="margin-bottom: 10px;">🏦 <strong>Banking Details</strong> - For payment processing</li>
              <li style="margin-bottom: 10px;">📋 <strong>Insurance & Licenses</strong> - Upload required documents</li>
              <li style="margin-bottom: 10px;">✍️ <strong>Vendor Agreement</strong> - Review and sign our agreement</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${onboardingLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-size: 16px; font-weight: bold;">Complete Registration</a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 25px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #888; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">${onboardingLink}</p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              This registration link will expire in 30 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Email failed to send:", emailResponse.error);
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending vendor onboarding invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
