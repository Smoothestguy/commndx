import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Starting stale clock check...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate 30-minute threshold
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    console.log(`Checking for entries with last_location_check_at before: ${staleThreshold}`);

    // Find stale time entries that need auto-clock-out
    const { data: staleEntries, error: queryError } = await supabase
      .from('time_entries')
      .select(`
        id,
        personnel_id,
        project_id,
        clock_in_at,
        last_location_check_at,
        is_on_lunch,
        projects!inner (
          id,
          name,
          require_clock_location
        ),
        personnel!inner (
          id,
          first_name,
          last_name,
          user_id
        )
      `)
      .is('clock_out_at', null)
      .not('clock_in_at', 'is', null)
      .lt('last_location_check_at', staleThreshold)
      .eq('auto_clocked_out', false)
      .eq('is_on_lunch', false)
      .eq('projects.require_clock_location', true);

    if (queryError) {
      console.error('Error querying stale entries:', queryError);
      throw queryError;
    }

    console.log(`Found ${staleEntries?.length || 0} stale entries to process`);

    if (!staleEntries || staleEntries.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No stale entries found', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    const now = new Date();
    const blockUntil = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(); // 8 hours from now

    for (const entry of staleEntries) {
      const project = entry.projects as any;
      const personnel = entry.personnel as any;
      const personnelName = `${personnel.first_name} ${personnel.last_name}`;

      console.log(`Processing stale entry for ${personnelName} on project ${project.name}`);

      // Calculate hours worked
      const clockInTime = new Date(entry.clock_in_at);
      const hoursWorked = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      // Auto-clock out the entry
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          clock_out_at: now.toISOString(),
          auto_clocked_out: true,
          auto_clock_out_reason: 'No location update for 30+ minutes',
          clock_blocked_until: blockUntil,
          total_hours: hoursWorked
        })
        .eq('id', entry.id);

      if (updateError) {
        console.error(`Error updating entry ${entry.id}:`, updateError);
        results.push({ id: entry.id, success: false, error: updateError.message });
        continue;
      }

      // Create clock alert
      const { error: alertError } = await supabase
        .from('clock_alerts')
        .insert({
          time_entry_id: entry.id,
          personnel_id: entry.personnel_id,
          project_id: entry.project_id,
          alert_type: 'auto_clock_out',
          alert_date: now.toISOString().split('T')[0],
          metadata: {
            reason: 'stale_location',
            last_location_check_at: entry.last_location_check_at,
            hours_worked: hoursWorked.toFixed(2),
            blocked_until: blockUntil
          }
        });

      if (alertError) {
        console.error(`Error creating alert for entry ${entry.id}:`, alertError);
      }

      // Send admin notification
      try {
        const notificationResponse = await supabase.functions.invoke('create-admin-notification', {
          body: {
            notification_type: 'auto_clock_out',
            title: 'Personnel Auto-Clocked Out (Stale Location)',
            message: `${personnelName} was automatically clocked out from ${project.name} - no location update received for 30+ minutes.`,
            link_url: `/personnel/${entry.personnel_id}`,
            related_id: entry.id,
            metadata: {
              personnel_id: entry.personnel_id,
              personnel_name: personnelName,
              project_id: entry.project_id,
              project_name: project.name,
              reason: 'stale_location',
              hours_worked: hoursWorked.toFixed(2)
            }
          }
        });

        if (notificationResponse.error) {
          console.error('Error sending notification:', notificationResponse.error);
        }
      } catch (notifyError) {
        console.error('Failed to send admin notification:', notifyError);
      }

      console.log(`Successfully auto-clocked out ${personnelName} after ${hoursWorked.toFixed(2)} hours`);
      results.push({ 
        id: entry.id, 
        success: true, 
        personnel: personnelName,
        project: project.name,
        hoursWorked: hoursWorked.toFixed(2)
      });
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Stale clock check complete. Processed ${successCount}/${staleEntries.length} entries.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Auto-clocked out ${successCount} stale entries`,
        processed: successCount,
        total: staleEntries.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in check-stale-clocks:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
