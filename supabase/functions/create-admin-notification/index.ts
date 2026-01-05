import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    | "general";
  title: string;
  message: string;
  link_url?: string;
  related_id?: string;
  metadata?: Record<string, unknown>;
  // Optional: specify user IDs to notify. If not provided, notifies all admins/managers
  target_user_ids?: string[];
}

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

    const { notification_type, title, message, link_url, related_id, metadata, target_user_ids } = body;

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
    }));

    const { error: insertError } = await supabase
      .from("admin_notifications")
      .insert(notifications);

    if (insertError) {
      console.error("Error inserting notifications:", insertError);
      throw insertError;
    }

    console.log(`Created ${notifications.length} notifications for users:`, eligibleUsers);

    return new Response(
      JSON.stringify({ success: true, count: notifications.length }),
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
