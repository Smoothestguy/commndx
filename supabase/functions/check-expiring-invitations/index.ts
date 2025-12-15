import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for cron job
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log("Checking for expiring invitations...");

    // Get invitations expiring within 24 hours
    const twentyFourHoursFromNow = new Date();
    twentyFourHoursFromNow.setHours(twentyFourHoursFromNow.getHours() + 24);

    const { data: expiringInvitations, error: invitationsError } = await supabaseAdmin
      .from("invitations")
      .select("id, email, role, invited_by, expires_at")
      .eq("status", "pending")
      .lte("expires_at", twentyFourHoursFromNow.toISOString())
      .gte("expires_at", new Date().toISOString());

    if (invitationsError) {
      console.error("Error fetching expiring invitations:", invitationsError);
      throw invitationsError;
    }

    console.log(`Found ${expiringInvitations?.length || 0} expiring invitations`);

    let invitationsByAdmin = new Map<string, any[]>();

    // Check if any reminders were already sent
    const invitationIds = expiringInvitations?.map(inv => inv.id) || [];
    if (invitationIds.length > 0) {
      const { data: existingReminders } = await supabaseAdmin
        .from("invitation_activity_log")
        .select("invitation_id")
        .in("invitation_id", invitationIds)
        .eq("action", "reminder_sent");

      const reminderSentIds = new Set(existingReminders?.map(r => r.invitation_id) || []);
      
      // Filter out invitations that already had reminders sent
      const invitationsNeedingReminders = expiringInvitations?.filter(
        inv => !reminderSentIds.has(inv.id)
      ) || [];

      // Group invitations by admin
      invitationsByAdmin = new Map<string, typeof invitationsNeedingReminders>();
      for (const invitation of invitationsNeedingReminders) {
        const adminId = invitation.invited_by;
        if (!invitationsByAdmin.has(adminId)) {
          invitationsByAdmin.set(adminId, []);
        }
        invitationsByAdmin.get(adminId)!.push(invitation);
      }

      console.log(`Sending reminders to ${invitationsByAdmin.size} admins`);

      // Send reminder emails to each admin
      for (const [adminId, invitations] of invitationsByAdmin.entries()) {
        // Fetch admin profile
        const { data: adminProfile, error: adminError } = await supabaseAdmin
          .from("profiles")
          .select("email, first_name, last_name")
          .eq("id", adminId)
          .single();

        if (adminError || !adminProfile) {
          console.error("Error fetching admin profile:", adminError);
          continue;
        }

        const adminName = adminProfile.first_name && adminProfile.last_name
          ? `${adminProfile.first_name} ${adminProfile.last_name}`
          : adminProfile.email;

        // Build email content
        const invitationsList = invitations
          .map((inv) => {
            const expiresAt = new Date(inv.expires_at);
            const hoursUntilExpiry = Math.round(
              (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
            );
            return `
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${inv.email}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-transform: capitalize;">${inv.role}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #dc2626;">${hoursUntilExpiry}h remaining</td>
              </tr>
            `;
          })
          .join("");

        // Send email via Resend
        const emailResponse = await resend.emails.send({
          from: "Fairfield <admin@fairfieldrg.com>",
          to: [adminProfile.email],
          subject: `⏰ ${invitations.length} Invitation${invitations.length > 1 ? "s" : ""} Expiring Soon`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1f2937; margin-bottom: 24px;">Expiring Invitations Reminder</h1>
              <p style="color: #4b5563; margin-bottom: 16px;">Hi ${adminName},</p>
              <p style="color: #4b5563; margin-bottom: 24px;">
                You have ${invitations.length} pending invitation${invitations.length > 1 ? "s" : ""} 
                that will expire within the next 24 hours:
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #f9fafb;">
                <thead>
                  <tr style="background-color: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Email</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Role</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Time Left</th>
                  </tr>
                </thead>
                <tbody>
                  ${invitationsList}
                </tbody>
              </table>
              
              <p style="color: #4b5563; margin-bottom: 8px;">
                You can resend or cancel these invitations from the User Management page.
              </p>
              
              <p style="color: #9ca3af; font-size: 14px; margin-top: 32px;">
                This is an automated reminder from your invitation management system.
              </p>
            </div>
          `,
        });

        console.log("Reminder email sent to admin:", adminProfile.email, emailResponse);

        // Log reminder_sent events for each invitation
        for (const invitation of invitations) {
          await supabaseAdmin.from("invitation_activity_log").insert({
            invitation_id: invitation.id,
            action: "reminder_sent",
            performed_by: null, // System action
            performed_by_email: "System",
            target_email: invitation.email,
            target_role: invitation.role,
            metadata: {
              admin_notified: adminProfile.email,
              expires_at: invitation.expires_at,
            },
          });
        }
      }
    }

    // Expire old invitations and log expired events
    console.log("Expiring old invitations...");
    
    const { data: expiredInvitations, error: expiredError } = await supabaseAdmin
      .from("invitations")
      .select("id, email, role, invited_by")
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    if (expiredError) {
      console.error("Error fetching expired invitations:", expiredError);
    } else if (expiredInvitations && expiredInvitations.length > 0) {
      // Update status to expired
      await supabaseAdmin
        .from("invitations")
        .update({ status: "expired" })
        .in("id", expiredInvitations.map(inv => inv.id));

      // Log expired events
      for (const invitation of expiredInvitations) {
        await supabaseAdmin.from("invitation_activity_log").insert({
          invitation_id: invitation.id,
          action: "expired",
          performed_by: null, // System action
          performed_by_email: "System",
          target_email: invitation.email,
          target_role: invitation.role,
          metadata: {
            expired_at: new Date().toISOString(),
          },
        });
      }

      console.log(`Expired ${expiredInvitations.length} invitations`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: invitationsByAdmin?.size || 0,
        expired: expiredInvitations?.length || 0,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in check-expiring-invitations function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
