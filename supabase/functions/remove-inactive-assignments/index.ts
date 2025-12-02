import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting inactive assignment removal process...');

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    console.log('Checking for assignments with last activity before:', sevenDaysAgoISO);

    // Find active assignments where last_time_entry_at is more than 7 days ago
    // or last_time_entry_at is null and assigned_at is more than 7 days ago
    const { data: inactiveAssignments, error: fetchError } = await supabase
      .from('project_assignments')
      .select('id, user_id, project_id, last_time_entry_at, assigned_at')
      .eq('status', 'active')
      .or(`last_time_entry_at.lt.${sevenDaysAgoISO},and(last_time_entry_at.is.null,assigned_at.lt.${sevenDaysAgoISO})`);

    if (fetchError) {
      console.error('Error fetching inactive assignments:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${inactiveAssignments?.length || 0} inactive assignments`);

    if (inactiveAssignments && inactiveAssignments.length > 0) {
      const assignmentIds = inactiveAssignments.map(a => a.id);

      // Update status to 'removed'
      const { error: updateError } = await supabase
        .from('project_assignments')
        .update({ status: 'removed' })
        .in('id', assignmentIds);

      if (updateError) {
        console.error('Error updating assignments:', updateError);
        throw updateError;
      }

      console.log(`Successfully removed ${assignmentIds.length} inactive assignments`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        removed: inactiveAssignments?.length || 0,
        assignments: inactiveAssignments,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in remove-inactive-assignments:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});