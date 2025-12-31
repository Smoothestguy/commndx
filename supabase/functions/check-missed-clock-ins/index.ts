import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    
    // Calculate time 10 minutes ago for checking late clock-ins
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const currentTimeStr = now.toTimeString().slice(0, 8); // HH:MM:SS
    const tenMinutesAgoTimeStr = tenMinutesAgo.toTimeString().slice(0, 8);

    console.log(`Checking missed clock-ins for ${today}, current time: ${currentTimeStr}`);

    // Get all schedules for today where start time was more than 10 minutes ago
    const { data: schedules, error: schedulesError } = await supabase
      .from("personnel_schedules")
      .select(`
        id,
        personnel_id,
        project_id,
        scheduled_start_time
      `)
      .eq("scheduled_date", today)
      .lte("scheduled_start_time", tenMinutesAgoTimeStr);

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      throw schedulesError;
    }

    if (!schedules || schedules.length === 0) {
      console.log("No schedules found that are past due");
      return new Response(
        JSON.stringify({ success: true, checked: 0, alerts_created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${schedules.length} schedules to check`);

    let alertsCreated = 0;

    for (const schedule of schedules) {
      // Get project info
      const { data: project } = await supabase
        .from("projects")
        .select("id, name, time_clock_enabled")
        .eq("id", schedule.project_id)
        .single();

      // Skip if project doesn't have time clock enabled
      if (!project?.time_clock_enabled) {
        continue;
      }

      // Check if an alert was already sent for this schedule today
      const { data: existingAlert } = await supabase
        .from("clock_alerts")
        .select("id")
        .eq("personnel_id", schedule.personnel_id)
        .eq("project_id", schedule.project_id)
        .eq("alert_type", "missed_clock_in")
        .eq("alert_date", today)
        .maybeSingle();

      if (existingAlert) {
        console.log(`Alert already exists for personnel ${schedule.personnel_id} on project ${schedule.project_id}`);
        continue;
      }

      // Check if they clocked in today for this project
      const { data: clockEntry } = await supabase
        .from("time_entries")
        .select("id, clock_in_at")
        .eq("personnel_id", schedule.personnel_id)
        .eq("project_id", schedule.project_id)
        .eq("entry_date", today)
        .eq("entry_source", "clock")
        .maybeSingle();

      if (clockEntry) {
        // They clocked in - check if it was late (more than 10 min after scheduled)
        const clockInTime = new Date(clockEntry.clock_in_at);
        const scheduledTime = new Date(`${today}T${schedule.scheduled_start_time}`);
        const lateMinutes = Math.round((clockInTime.getTime() - scheduledTime.getTime()) / (1000 * 60));
        
        if (lateMinutes <= 10) {
          // Clocked in on time, no alert needed
          continue;
        }
        // If they were late, we might want to track that, but for now we skip
        // since they did clock in eventually
        continue;
      }

      // Personnel has not clocked in - create alert
      // Get personnel info
      const { data: personnel } = await supabase
        .from("personnel")
        .select("id, first_name, last_name")
        .eq("id", schedule.personnel_id)
        .single();

      console.log(`Creating missed clock-in alert for ${personnel?.first_name} ${personnel?.last_name}`);

      const personnelName = personnel 
        ? `${personnel.first_name} ${personnel.last_name}`
        : "Unknown personnel";

      // Create clock alert record
      await supabase
        .from("clock_alerts")
        .insert({
          personnel_id: schedule.personnel_id,
          project_id: schedule.project_id,
          alert_type: "missed_clock_in",
          alert_date: today,
          metadata: {
            scheduled_start_time: schedule.scheduled_start_time,
            checked_at: now.toISOString(),
          },
        });

      // Create admin notification
      await supabase.functions.invoke("create-admin-notification", {
        body: {
          notification_type: "missed_clock_in",
          title: "Missed Clock-In Alert",
          message: `${personnelName} has not clocked in to ${project?.name}. Scheduled start was ${schedule.scheduled_start_time} (now 10+ minutes late).`,
          link_url: `/personnel/${schedule.personnel_id}`,
          related_id: schedule.personnel_id,
          metadata: {
            schedule_id: schedule.id,
            project_id: schedule.project_id,
            scheduled_start_time: schedule.scheduled_start_time,
          },
        },
      });

      alertsCreated++;
    }

    console.log(`Checked ${schedules.length} schedules, created ${alertsCreated} alerts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        checked: schedules.length, 
        alerts_created: alertsCreated 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking missed clock-ins:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
