import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: "admin" | "manager" | "user";
  invitationId: string;
  token: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Send invitation function called");
    
    const authHeader = req.headers.get("Authorization");
    console.log("Authorization header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized - No auth header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify the user is an admin
    console.log("Attempting to get user...");
    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser();

    console.log("User retrieved:", user ? `ID: ${user.id}, Email: ${user.email}` : "null");
    
    if (userError) {
      console.error("Error getting user:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!user) {
      console.error("No user found in auth context");
      return new Response(JSON.stringify({ error: "Unauthorized - No user" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || roleData.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can send invitations" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { email, role, invitationId, token }: InvitationRequest = await req.json();

    console.log("Sending invitation to:", email, "with role:", role);

    // Get the site URL from environment or derive from Supabase URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const siteUrl = Deno.env.get("SITE_URL") || supabaseUrl.replace(".supabase.co", ".lovableproject.com");
    
    const invitationUrl = `${siteUrl}/accept-invitation?token=${token}`;

    const emailResponse = await resend.emails.send({
      from: "Fairfield <admin@fairfieldrg.com>",
      to: [email],
      subject: `You've been invited to join Fairfield as ${role}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">You're Invited! 🎉</h1>
              </div>
              <div class="content">
                <p>Hello!</p>
                <p>You've been invited to join <strong>Fairfield</strong> as a <strong>${role}</strong>.</p>
                <p>Fairfield is a business management platform for managing products, customers, estimates, job orders, and invoices.</p>
                <p>Click the button below to accept your invitation and create your account:</p>
                <a href="${invitationUrl}" class="button">Accept Invitation</a>
                <p style="font-size: 14px; color: #6b7280;">Or copy and paste this link into your browser:</p>
                <p style="font-size: 12px; word-break: break-all; color: #6b7280;">${invitationUrl}</p>
                <p style="margin-top: 30px;"><strong>Your role: ${role.charAt(0).toUpperCase() + role.slice(1)}</strong></p>
                <p style="font-size: 14px; color: #6b7280;">This invitation will expire in 7 days.</p>
                <div class="footer">
                  <p>If you didn't expect this invitation, you can safely ignore this email.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send invitation" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
