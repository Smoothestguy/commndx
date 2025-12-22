import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PortalInvitationRequest {
  personnelId: string;
  personnelName: string;
  email: string;
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header - please log in again" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError?.message || "No user found");
      return new Response(
        JSON.stringify({ error: "Session expired - please log out and log back in" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify user is admin or manager
    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!userRole || !["admin", "manager"].includes(userRole.role)) {
      throw new Error("Only admins and managers can send portal invitations");
    }

    const { personnelName, email, token }: PortalInvitationRequest = await req.json();

    const siteUrl = Deno.env.get("SITE_URL") || "https://xfjjvznxkcckuwxmcsdc.lovableproject.com";
    const inviteLink = `${siteUrl}/portal/accept-invite/${token}`;

    console.log(`Sending portal invitation to: ${email} for ${personnelName}`);

    const emailResponse = await resend.emails.send({
      from: "Fairfield <admin@fairfieldrg.com>",
      to: [email],
      subject: "You're invited to access your Personnel Portal",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Your Portal!</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${personnelName},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">You've been invited to access your Personnel Portal. This portal gives you direct access to:</p>
            
            <ul style="font-size: 15px; margin-bottom: 25px; padding-left: 20px;">
              <li style="margin-bottom: 8px;">📊 View your work hours and projects</li>
              <li style="margin-bottom: 8px;">💰 Track your pay and earnings</li>
              <li style="margin-bottom: 8px;">📝 Submit expense reimbursements</li>
              <li style="margin-bottom: 8px;">🔔 Manage your notification preferences</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Access My Portal</a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 15px;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 6px;">${inviteLink}</p>
            
            <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 13px; color: #9ca3af; margin: 0;">⏰ This invitation expires in 7 days.</p>
            </div>
          </div>
          
          <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 20px;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Email failed to send:", emailResponse.error);
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    console.log("Portal invitation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending portal invitation:", error);
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
