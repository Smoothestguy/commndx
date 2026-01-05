import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyLateClockAttemptRequest {
  personnel_id: string;
  project_id: string;
  scheduled_start_time: string;
  attempt_time: string;
  minutes_late: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotifyLateClockAttemptRequest = await req.json();
    const { personnel_id, project_id, scheduled_start_time, attempt_time, minutes_late } = body;

    console.log("Processing late clock-in attempt notification:", {
      personnel_id,
      project_id,
      scheduled_start_time,
      minutes_late,
    });

    // Get personnel details
    const { data: personnel, error: personnelError } = await supabase
      .from("personnel")
      .select("first_name, last_name")
      .eq("id", personnel_id)
      .single();

    if (personnelError) {
      console.error("Error fetching personnel:", personnelError);
      throw new Error("Failed to fetch personnel details");
    }

    const personnelName = `${personnel.first_name} ${personnel.last_name}`;

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name")
      .eq("id", project_id)
      .single();

    if (projectError) {
      console.error("Error fetching project:", projectError);
      throw new Error("Failed to fetch project details");
    }

    const projectName = project.name;

    // Create clock alert record
    const today = new Date().toISOString().split("T")[0];
    const { error: alertError } = await supabase
      .from("clock_alerts")
      .insert({
        alert_type: "late_clock_in_attempt",
        alert_date: today,
        personnel_id,
        project_id,
        notes: `Attempted to clock in ${Math.round(minutes_late)} minutes late. Scheduled: ${scheduled_start_time}. Attempt: ${attempt_time}`,
        metadata: {
          scheduled_start_time,
          attempt_time,
          minutes_late: Math.round(minutes_late),
        },
      });

    if (alertError) {
      console.error("Error creating clock alert:", alertError);
      // Don't throw - still try to send notification
    }

    // Create admin notification
    const notificationResponse = await supabase.functions.invoke("create-admin-notification", {
      body: {
        notification_type: "late_clock_in_attempt",
        title: "Late Clock-In Attempt Blocked",
        message: `${personnelName} attempted to clock in ${Math.round(minutes_late)} minutes late to ${projectName}. Clock-in was blocked.`,
        link_url: `/personnel/${personnel_id}`,
        related_id: personnel_id,
        metadata: {
          project_id,
          project_name: projectName,
          personnel_name: personnelName,
          scheduled_start_time,
          attempt_time,
          minutes_late: Math.round(minutes_late),
        },
      },
    });

    if (notificationResponse.error) {
      console.error("Error creating admin notification:", notificationResponse.error);
    }

    console.log("Late clock-in attempt notification sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Late clock-in attempt notification sent",
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in notify-late-clock-attempt:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
