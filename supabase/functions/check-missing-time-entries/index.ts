import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split("T")[0];

    // Get all active personnel
    const { data: personnel, error: pError } = await supabase
      .from("personnel")
      .select("id, first_name, last_name, user_id")
      .eq("status", "active");

    if (pError) throw pError;
    if (!personnel || personnel.length === 0) {
      return new Response(JSON.stringify({ message: "No active personnel" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get personnel who have logged time today
    const { data: entries, error: eError } = await supabase
      .from("time_entries")
      .select("personnel_id")
      .eq("entry_date", today)
      .not("personnel_id", "is", null);

    if (eError) throw eError;

    const loggedIds = new Set((entries || []).map((e: any) => e.personnel_id));
    const missing = personnel.filter((p: any) => !loggedIds.has(p.id));

    if (missing.length === 0) {
      return new Response(JSON.stringify({ message: "All personnel have logged time today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin/manager users for notifications
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["admin", "manager"]);

    // Create notifications for each admin
    const notifications = (admins || []).map((admin: any) => ({
      user_id: admin.id,
      notification_type: "missing_time_entries",
      title: "Missing Time Entries",
      message: `${missing.length} personnel have not logged time for today: ${missing.map((p: any) => `${p.first_name} ${p.last_name}`).join(", ")}`,
      priority: "high",
      group_key: `missing_time_${today}`,
    }));

    if (notifications.length > 0) {
      await supabase.from("admin_notifications").upsert(notifications, {
        onConflict: "group_key,user_id",
      });
    }

    return new Response(
      JSON.stringify({ missing: missing.length, notified: notifications.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
