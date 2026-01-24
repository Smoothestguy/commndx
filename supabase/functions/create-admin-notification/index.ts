import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotificationPriority = "critical" | "high" | "normal" | "low";

interface CreateNotificationRequest {
  notification_type: 
    | "po_approval" 
    | "co_approval" 
    | "personnel_registration" 
    | "new_application"
    | "application_approved"
    | "application_rejected"
    | "onboarding_email_sent"
    | "onboarding_started"
    | "onboarding_complete"
    | "missed_clock_in"
    | "auto_clock_out"
    | "geofence_violation"
    | "late_clock_in_attempt"
    | "message_failed"
    | "general";
  title: string;
  message: string;
  link_url?: string;
  related_id?: string;
  metadata?: Record<string, unknown>;
  priority?: NotificationPriority;
  group_key?: string;
  // Optional: specify user IDs to notify. If not provided, notifies all admins/managers
  target_user_ids?: string[];
}

// Default priority mapping based on notification type
const DEFAULT_PRIORITIES: Record<string, NotificationPriority> = {
  message_failed: "critical",
  late_clock_in_attempt: "critical",
  missed_clock_in: "critical",
  auto_clock_out: "critical",
  geofence_violation: "critical",
  po_approval: "high",
  co_approval: "high",
  personnel_registration: "high",
  new_application: "high",
  application_approved: "normal",
  application_rejected: "normal",
  onboarding_email_sent: "normal",
  onboarding_started: "normal",
  onboarding_complete: "normal",
  general: "normal",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateNotificationRequest = await req.json();
    console.log("Creating admin notification:", body);

    const { notification_type, title, message, link_url, related_id, metadata, target_user_ids, priority, group_key } = body;

    // Determine final priority
    const finalPriority = priority || DEFAULT_PRIORITIES[notification_type] || "normal";

    let userIds: string[] = [];

    if (target_user_ids && target_user_ids.length > 0) {
      userIds = target_user_ids;
    } else {
      // Get all admin and manager users
      const { data: adminUsers, error: usersError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "manager"]);

      if (usersError) {
        console.error("Error fetching admin users:", usersError);
        throw usersError;
      }

      userIds = adminUsers?.map((u) => u.user_id) || [];
    }

    if (userIds.length === 0) {
      console.log("No users to notify");
      return new Response(
        JSON.stringify({ success: true, message: "No users to notify", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check notification preferences for each user
    const { data: preferences, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("user_id, po_submitted_for_approval, co_submitted_for_approval, personnel_registration_pending")
      .in("user_id", userIds);

    if (prefsError) {
      console.error("Error fetching notification preferences:", prefsError);
    }

    const prefsMap = new Map(preferences?.map((p) => [p.user_id, p]) || []);

    // Filter users based on their preferences
    const eligibleUsers = userIds.filter((userId) => {
      const userPrefs = prefsMap.get(userId);
      
      // If no preferences set, default to receiving all notifications
      if (!userPrefs) return true;

      switch (notification_type) {
        case "po_approval":
          return userPrefs.po_submitted_for_approval !== false;
        case "co_approval":
          return userPrefs.co_submitted_for_approval !== false;
        case "personnel_registration":
          return userPrefs.personnel_registration_pending !== false;
        default:
          return true;
      }
    });

    if (eligibleUsers.length === 0) {
      console.log("No eligible users after preference filtering");
      return new Response(
        JSON.stringify({ success: true, message: "No eligible users to notify", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If group_key is provided, check for existing notification to update instead of creating duplicate
    if (group_key) {
      for (const user_id of eligibleUsers) {
        const { data: existingNotification } = await supabase
          .from("admin_notifications")
          .select("id, count")
          .eq("user_id", user_id)
          .eq("group_key", group_key)
          .eq("is_read", false)
          .single();

        if (existingNotification) {
          // Update existing notification instead of creating new
          await supabase
            .from("admin_notifications")
            .update({
              title,
              message,
              count: (existingNotification.count || 1) + 1,
              metadata: metadata || {},
            })
            .eq("id", existingNotification.id);
        }
      }
    }

    // Create notifications for all eligible users
    const notifications = eligibleUsers.map((user_id) => ({
      user_id,
      title,
      message,
      notification_type,
      link_url: link_url || null,
      related_id: related_id || null,
      metadata: metadata || {},
      is_read: false,
      priority: finalPriority,
      group_key: group_key || null,
      escalation_count: 0,
      count: 1,
    }));

    const { error: insertError } = await supabase
      .from("admin_notifications")
      .insert(notifications);

    if (insertError) {
      console.error("Error inserting notifications:", insertError);
      throw insertError;
    }

    console.log(`Created ${notifications.length} notifications with priority ${finalPriority} for users:`, eligibleUsers);

    return new Response(
      JSON.stringify({ success: true, count: notifications.length, priority: finalPriority }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating admin notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
