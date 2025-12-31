import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Haversine formula to calculate distance between two coordinates in miles
function calculateDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface UpdateLocationRequest {
  time_entry_id: string;
  lat: number;
  lng: number;
  accuracy?: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: UpdateLocationRequest = await req.json();
    console.log("Updating clock location:", body);

    const { time_entry_id, lat, lng, accuracy } = body;

    if (!time_entry_id || lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: time_entry_id, lat, lng" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the time entry with project info
    const { data: timeEntry, error: entryError } = await supabase
      .from("time_entries")
      .select(`
        id,
        personnel_id,
        project_id,
        clock_in_at,
        clock_out_at,
        is_on_lunch,
        lunch_duration_minutes,
        clock_blocked_until
      `)
      .eq("id", time_entry_id)
      .single();

    if (entryError || !timeEntry) {
      console.error("Time entry not found:", entryError);
      return new Response(
        JSON.stringify({ error: "Time entry not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if already clocked out
    if (timeEntry.clock_out_at) {
      return new Response(
        JSON.stringify({ success: true, message: "Already clocked out" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if on lunch break
    if (timeEntry.is_on_lunch) {
      // Just update the location but don't check geofence
      await supabase
        .from("time_entries")
        .update({
          last_location_lat: lat,
          last_location_lng: lng,
          last_location_check_at: new Date().toISOString(),
        })
        .eq("id", time_entry_id);

      return new Response(
        JSON.stringify({ success: true, message: "Location updated (on lunch, geofence skipped)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get project geofence settings
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, site_lat, site_lng, geofence_radius_miles, require_clock_location")
      .eq("id", timeEntry.project_id)
      .single();

    if (projectError || !project) {
      console.error("Project not found:", projectError);
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the last known location
    await supabase
      .from("time_entries")
      .update({
        last_location_lat: lat,
        last_location_lng: lng,
        last_location_check_at: new Date().toISOString(),
      })
      .eq("id", time_entry_id);

    // Check geofence only if project has coordinates and requires location
    if (project.require_clock_location && project.site_lat && project.site_lng) {
      const radiusMiles = project.geofence_radius_miles || 0.25;
      const distance = calculateDistanceMiles(lat, lng, project.site_lat, project.site_lng);
      
      console.log(`Distance from site: ${distance.toFixed(3)} miles, radius: ${radiusMiles} miles`);

      if (distance > radiusMiles) {
        // User is outside geofence - auto clock out
        console.log("User outside geofence, auto-clocking out");

        const now = new Date();
        const clockIn = new Date(timeEntry.clock_in_at);
        const totalMs = now.getTime() - clockIn.getTime();
        const lunchMs = (timeEntry.lunch_duration_minutes || 0) * 60 * 1000;
        const workMs = totalMs - lunchMs;
        const hoursWorked = Math.round((workMs / (1000 * 60 * 60)) * 10000) / 10000;

        // Set block until 8 hours from now (requires admin to clear)
        const blockUntil = new Date();
        blockUntil.setHours(blockUntil.getHours() + 8);

        // Update time entry with auto clock out
        const { error: updateError } = await supabase
          .from("time_entries")
          .update({
            clock_out_at: now.toISOString(),
            clock_out_lat: lat,
            clock_out_lng: lng,
            clock_out_accuracy: accuracy || null,
            hours: hoursWorked,
            regular_hours: hoursWorked,
            auto_clocked_out: true,
            auto_clock_out_reason: `Left job site - ${distance.toFixed(2)} miles from site (limit: ${radiusMiles} miles)`,
            clock_blocked_until: blockUntil.toISOString(),
            is_on_lunch: false,
          })
          .eq("id", time_entry_id);

        if (updateError) {
          console.error("Error auto-clocking out:", updateError);
          throw updateError;
        }

        // Get personnel info for notification
        const { data: personnel } = await supabase
          .from("personnel")
          .select("first_name, last_name")
          .eq("id", timeEntry.personnel_id)
          .single();

        const personnelName = personnel 
          ? `${personnel.first_name} ${personnel.last_name}`
          : "Unknown personnel";

        // Create clock alert
        await supabase
          .from("clock_alerts")
          .insert({
            personnel_id: timeEntry.personnel_id,
            project_id: timeEntry.project_id,
            time_entry_id: time_entry_id,
            alert_type: "auto_clock_out",
            alert_date: now.toISOString().split("T")[0],
            metadata: {
              distance_miles: distance,
              radius_miles: radiusMiles,
              location: { lat, lng },
            },
          });

        // Create admin notification
        await supabase.functions.invoke("create-admin-notification", {
          body: {
            notification_type: "auto_clock_out",
            title: "Personnel Auto-Clocked Out",
            message: `${personnelName} was automatically clocked out from ${project.name} for leaving the job site (${distance.toFixed(2)} mi away).`,
            link_url: `/personnel/${timeEntry.personnel_id}`,
            related_id: timeEntry.personnel_id,
            metadata: {
              time_entry_id,
              project_id: project.id,
              distance_miles: distance,
            },
          },
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            auto_clocked_out: true,
            reason: `Left job site - ${distance.toFixed(2)} miles away`,
            blocked_until: blockUntil.toISOString(),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Location updated" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating clock location:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
