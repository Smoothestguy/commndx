import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  invitationId: string;
  newUserEmail: string;
  newUserName: string;
  role: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invitationId, newUserEmail, newUserName, role }: NotificationRequest = await req.json();

    console.log("Processing invitation acceptance notification:", {
      invitationId,
      newUserEmail,
      newUserName,
      role,
    });

    // Get the invitation details including who sent it
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .select("invited_by")
      .eq("id", invitationId)
      .single();

    if (inviteError) {
      console.error("Error fetching invitation:", inviteError);
      throw new Error("Failed to fetch invitation details");
    }

    // Get the admin's profile (email)
    const { data: adminProfile, error: adminError } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", invitation.invited_by)
      .single();

    if (adminError || !adminProfile?.email) {
      console.error("Error fetching admin profile:", adminError);
      throw new Error("Failed to fetch admin details");
    }

    const adminName = adminProfile.first_name && adminProfile.last_name 
      ? `${adminProfile.first_name} ${adminProfile.last_name}`
      : adminProfile.email;

    // Send notification email to admin
    const emailResponse = await resend.emails.send({
      from: "Fairfield <admin@fairfieldrg.com>",
      to: [adminProfile.email],
      subject: "User Invitation Accepted",
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb; margin-bottom: 16px;">Invitation Accepted</h2>
          <p style="color: #374151; margin-bottom: 16px;">
            Hi ${adminName},
          </p>
          <p style="color: #374151; margin-bottom: 16px;">
            Great news! A user has accepted your invitation and created their account.
          </p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">New User Details:</p>
            <p style="margin: 4px 0; color: #111827;"><strong>Name:</strong> ${newUserName}</p>
            <p style="margin: 4px 0; color: #111827;"><strong>Email:</strong> ${newUserEmail}</p>
            <p style="margin: 4px 0; color: #111827;"><strong>Role:</strong> <span style="text-transform: capitalize;">${role}</span></p>
            <p style="margin: 4px 0; color: #111827;"><strong>Joined:</strong> ${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
          <p style="color: #374151; margin-bottom: 16px;">
            The user can now access the system with their assigned ${role} role.
          </p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
            Best regards,<br>
            Fairfield Team
          </p>
        </div>
      `,
    });

    console.log("Notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in notify-invitation-accepted function:", error);
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
