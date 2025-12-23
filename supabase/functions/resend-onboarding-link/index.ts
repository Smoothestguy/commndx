import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendLinkRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ResendLinkRequest = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log("[Resend Onboarding] Request for email:", normalizedEmail);

    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up personnel by email
    const { data: personnel, error: personnelError } = await supabase
      .from("personnel")
      .select("id, first_name, last_name, email, onboarding_status")
      .ilike("email", normalizedEmail)
      .single();

    if (personnelError || !personnel) {
      console.log("[Resend Onboarding] No personnel found for email:", normalizedEmail);
      // Log failed attempt
      await supabase.from("admin_notifications").insert({
        notification_type: "onboarding_link_request_failed",
        title: "Onboarding Link Request - Not Found",
        message: `Someone requested a new onboarding link for ${normalizedEmail} but no personnel record was found.`,
        user_id: "00000000-0000-0000-0000-000000000000", // System notification
        metadata: { requested_email: normalizedEmail, reason: "not_found" },
      });
      
      // Return success to prevent email enumeration
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account exists with this email, a new onboarding link will be sent." 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if onboarding is already completed
    if (personnel.onboarding_status === "completed") {
      console.log("[Resend Onboarding] Onboarding already completed for:", normalizedEmail);
      await supabase.from("admin_notifications").insert({
        notification_type: "onboarding_link_request_completed",
        title: "Onboarding Link Request - Already Complete",
        message: `${personnel.first_name} ${personnel.last_name} (${normalizedEmail}) requested a new link but onboarding is already completed.`,
        user_id: "00000000-0000-0000-0000-000000000000",
        link_url: `/personnel/${personnel.id}`,
        related_id: personnel.id,
        metadata: { personnel_name: `${personnel.first_name} ${personnel.last_name}` },
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account exists with this email, a new onboarding link will be sent." 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check for rate limiting - only allow one request per hour per email
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentTokens, error: recentError } = await supabase
      .from("personnel_onboarding_tokens")
      .select("created_at")
      .eq("personnel_id", personnel.id)
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!recentError && recentTokens && recentTokens.length > 0) {
      console.log("[Resend Onboarding] Rate limited - recent token exists for:", normalizedEmail);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account exists with this email, a new onboarding link will be sent." 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate a new token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const { error: tokenError } = await supabase
      .from("personnel_onboarding_tokens")
      .insert({
        personnel_id: personnel.id,
        token: token,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error("[Resend Onboarding] Error creating token:", tokenError);
      throw tokenError;
    }

    console.log("[Resend Onboarding] Token created for:", personnel.id);

    // Build onboarding URL
    const siteUrl = (Deno.env.get("SITE_URL") || "https://command-x.lovable.app").trim();
    const onboardingUrl = encodeURI(`${siteUrl}/onboard/${token}`);

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "Fairfield <admin@fairfieldrg.com>",
      to: [personnel.email],
      subject: "Your New Onboarding Link",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">New Onboarding Link</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px;">Hi ${personnel.first_name},</p>
            
            <p>You requested a new onboarding link. Please use the button below to complete your onboarding documentation.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${onboardingUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Complete Onboarding</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">This link will expire in 7 days. If you did not request this link, please ignore this email.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0; word-break: break-all;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${onboardingUrl}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; word-break: break-all;">${onboardingUrl}</a>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("[Resend Onboarding] Resend error:", emailResponse.error);
      throw new Error(`Email sending failed: ${emailResponse.error.message}`);
    }

    console.log("[Resend Onboarding] Email sent successfully, ID:", emailResponse.data?.id);

    // Log the successful resend
    await supabase.from("admin_notifications").insert({
      notification_type: "onboarding_link_resent",
      title: `Onboarding Link Resent: ${personnel.first_name} ${personnel.last_name}`,
      message: `A new onboarding link was sent to ${personnel.email} at their request. Link expires in 7 days.`,
      user_id: "00000000-0000-0000-0000-000000000000",
      link_url: `/personnel/${personnel.id}`,
      related_id: personnel.id,
      metadata: {
        personnel_name: `${personnel.first_name} ${personnel.last_name}`,
        personnel_email: personnel.email,
        token_expires: expiresAt.toISOString(),
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "If an account exists with this email, a new onboarding link will be sent." 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Resend Onboarding] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Failed to process request. Please try again later." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
