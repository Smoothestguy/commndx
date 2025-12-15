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

    // Calculate date 8 days ago for inactivity threshold
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
    const eightDaysAgoISO = eightDaysAgo.toISOString();

    // Calculate date 14 days ago for grace period (new assignments)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fourteenDaysAgoISO = fourteenDaysAgo.toISOString();

    console.log('Checking for assignments with last activity before:', eightDaysAgoISO);
    console.log('Grace period: only removing assignments created before:', fourteenDaysAgoISO);

    // ==========================================
    // Process PERSONNEL project assignments ONLY
    // New assignments (within 14 days) are protected by grace period
    // ==========================================
    const { data: personnelAssignments, error: personnelFetchError } = await supabase
      .from('personnel_project_assignments')
      .select('id, personnel_id, project_id, last_time_entry_at, assigned_at')
      .eq('status', 'active')
      .lt('assigned_at', fourteenDaysAgoISO)
      .or(`last_time_entry_at.lt.${eightDaysAgoISO},last_time_entry_at.is.null`);

    if (personnelFetchError) {
      console.error('Error fetching inactive personnel assignments:', personnelFetchError);
      throw personnelFetchError;
    }

    console.log(`Found ${personnelAssignments?.length || 0} inactive personnel assignments`);

    const now = new Date();
    const removalLogs: any[] = [];

    // Process personnel assignments
    if (personnelAssignments && personnelAssignments.length > 0) {
      const personnelAssignmentIds = personnelAssignments.map(a => a.id);

      // Update status to 'removed'
      const { error: personnelUpdateError } = await supabase
        .from('personnel_project_assignments')
        .update({ status: 'removed' })
        .in('id', personnelAssignmentIds);

      if (personnelUpdateError) {
        console.error('Error updating personnel assignments:', personnelUpdateError);
        throw personnelUpdateError;
      }

      // Prepare audit logs for personnel assignments
      for (const assignment of personnelAssignments) {
        const lastActivity = assignment.last_time_entry_at || assignment.assigned_at;
        const daysInactive = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
        
        removalLogs.push({
          assignment_type: 'personnel',
          assignment_id: assignment.id,
          user_id: null,
          personnel_id: assignment.personnel_id,
          project_id: assignment.project_id,
          last_activity_at: lastActivity,
          days_inactive: daysInactive,
        });
      }

      console.log(`Successfully removed ${personnelAssignmentIds.length} inactive personnel assignments`);
    }

    // Insert audit logs
    if (removalLogs.length > 0) {
      const { error: logError } = await supabase
        .from('assignment_removal_log')
        .insert(removalLogs);

      if (logError) {
        console.error('Error inserting removal logs:', logError);
        // Don't throw - logging failure shouldn't fail the whole operation
      } else {
        console.log(`Logged ${removalLogs.length} removal records to audit table`);
      }
    }

    const totalRemoved = personnelAssignments?.length || 0;

    return new Response(
      JSON.stringify({
        success: true,
        removed: {
          total: totalRemoved,
          personnelAssignments: totalRemoved,
        },
        inactivityThresholdDays: 8,
        checkDate: eightDaysAgoISO,
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
