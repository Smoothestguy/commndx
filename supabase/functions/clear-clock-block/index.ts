import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClearBlockRequest {
  time_entry_id?: string;
  personnel_id?: string;
  notes?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ClearBlockRequest = await req.json();
    console.log("Clearing clock block:", body);

    const { time_entry_id, personnel_id, notes } = body;

    if (!time_entry_id && !personnel_id) {
      return new Response(
        JSON.stringify({ error: "Must provide time_entry_id or personnel_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();

    if (time_entry_id) {
      // Clear block on specific time entry
      const { error } = await supabase
        .from("time_entries")
        .update({ clock_blocked_until: null })
        .eq("id", time_entry_id);

      if (error) throw error;

      // Resolve related alerts
      await supabase
        .from("clock_alerts")
        .update({
          resolved_at: now,
          notes: notes || "Block cleared by admin",
        })
        .eq("time_entry_id", time_entry_id)
        .is("resolved_at", null);

    } else if (personnel_id) {
      // Clear all blocks for a personnel
      const { error } = await supabase
        .from("time_entries")
        .update({ clock_blocked_until: null })
        .eq("personnel_id", personnel_id)
        .gt("clock_blocked_until", now);

      if (error) throw error;

      // Resolve related alerts
      await supabase
        .from("clock_alerts")
        .update({
          resolved_at: now,
          notes: notes || "All blocks cleared by admin",
        })
        .eq("personnel_id", personnel_id)
        .is("resolved_at", null);
    }

    console.log("Clock block cleared successfully");

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error clearing clock block:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
