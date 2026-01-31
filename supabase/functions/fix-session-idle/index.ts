import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin/manager
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdminOrManager = roleData?.role === "admin" || roleData?.role === "manager";

    const { sessionId, mode, idleSeconds, startOfToday } = await req.json();

    // Handle fixAllToday mode - reset idle for all sessions from today
    if (mode === "fixAllToday") {
      if (!startOfToday) {
        return new Response(JSON.stringify({ error: "startOfToday is required for fixAllToday mode" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find all sessions for this user from today
      const { data: todaySessions, error: sessionsError } = await supabaseClient
        .from("user_work_sessions")
        .select("id, total_idle_seconds, idle_correction_version")
        .eq("user_id", user.id)
        .gte("session_start", startOfToday);

      if (sessionsError) {
        console.error("Error fetching today's sessions:", sessionsError);
        return new Response(JSON.stringify({ error: "Failed to fetch sessions" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!todaySessions || todaySessions.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: "No sessions found for today",
          sessionsFixed: 0 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Calculate total idle being reset
      const totalIdleReset = todaySessions.reduce((sum, s) => sum + (s.total_idle_seconds || 0), 0);

      // Update all sessions to 0 idle
      const sessionIds = todaySessions.map(s => s.id);
      const { error: updateError } = await supabaseClient
        .from("user_work_sessions")
        .update({
          total_idle_seconds: 0,
          idle_corrected_at: new Date().toISOString(),
        })
        .in("id", sessionIds);

      if (updateError) {
        console.error("Error updating sessions:", updateError);
        return new Response(JSON.stringify({ error: "Failed to update sessions" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Fixed ${todaySessions.length} sessions for user ${user.id}: reset ${totalIdleReset}s total idle to 0`);

      return new Response(
        JSON.stringify({
          success: true,
          sessionsFixed: todaySessions.length,
          totalIdleReset,
          mode: "fixAllToday",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Original single-session modes below
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check session ownership
    const { data: session, error: sessionError } = await supabaseClient
      .from("user_work_sessions")
      .select("user_id, total_idle_seconds, total_active_seconds, session_start, idle_correction_version")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only allow if admin/manager OR session owner
    if (!isAdminOrManager && session.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not authorized to modify this session" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let newIdleSeconds: number;

    if (mode === "set") {
      // Direct set mode
      if (typeof idleSeconds !== "number" || idleSeconds < 0) {
        return new Response(JSON.stringify({ error: "idleSeconds must be a non-negative number" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      newIdleSeconds = idleSeconds;
    } else if (mode === "recalc") {
      // Recalculate from activity log
      const { data: logs, error: logsError } = await supabaseClient
        .from("session_activity_log")
        .select("activity_type, created_at")
        .eq("session_id", sessionId)
        .in("activity_type", ["idle_start", "idle_end"])
        .order("created_at", { ascending: true });

      if (logsError) {
        console.error("Error fetching activity logs:", logsError);
        return new Response(JSON.stringify({ error: "Failed to fetch activity logs" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let totalIdleMs = 0;
      let pendingIdleStart: Date | null = null;

      for (const log of logs || []) {
        if (log.activity_type === "idle_start") {
          pendingIdleStart = new Date(log.created_at);
        } else if (log.activity_type === "idle_end" && pendingIdleStart) {
          const idleEnd = new Date(log.created_at);
          const duration = idleEnd.getTime() - pendingIdleStart.getTime();
          // Cap individual idle periods to 30 minutes max to prevent runaway totals
          totalIdleMs += Math.min(duration, 30 * 60 * 1000);
          pendingIdleStart = null;
        }
      }

      // If there's an orphan idle_start (no matching idle_end), cap it at 5 minutes
      if (pendingIdleStart) {
        totalIdleMs += 5 * 60 * 1000; // 5 minutes max for orphan
        console.log("Found orphan idle_start, capping at 5 minutes");
      }

      newIdleSeconds = Math.floor(totalIdleMs / 1000);
    } else {
      return new Response(JSON.stringify({ error: "mode must be 'set', 'recalc', or 'fixAllToday'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the session with new idle seconds AND bump correction version
    const newCorrectionVersion = (session.idle_correction_version || 0) + 1;
    const { error: updateError } = await supabaseClient
      .from("user_work_sessions")
      .update({
        total_idle_seconds: newIdleSeconds,
        idle_correction_version: newCorrectionVersion,
        idle_corrected_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Error updating session:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Fixed session ${sessionId}: set idle to ${newIdleSeconds}s (mode: ${mode})`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        previousIdleSeconds: session.total_idle_seconds,
        newIdleSeconds,
        newCorrectionVersion,
        mode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
