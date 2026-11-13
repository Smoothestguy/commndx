import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {homeRows} from '@/hooks/useHomeOperations';
import type {ProjectLocation} from '@/integrations/supabase/hooks/useProjectLocations';
import {demobilizedFilter} from '@/integrations/supabase/hooks/useLocationStaffing';

export function useGlobalLocations() {
  return useQuery({queryKey:['project-locations','global'],refetchInterval:60000,queryFn:async()=>{
    const [projects,locations]=await Promise.all([
      homeRows(o=>supabase.from('projects').select('id,name,type_id,customer_id').order('id').range(o,o+499)),
      homeRows(o=>supabase.from('project_locations').select('*').order('id').range(o,o+499)),
    ]);
    return {projects,locations:locations as ProjectLocation[]};
  }});
}
/** Counts only: no directory identities or financial rates in the global grid. */
export function useGlobalLocationStaffing(ids:string[]) {
  return useQuery({queryKey:['global-location-staffing',ids.slice().sort()],enabled:ids.length>0,refetchInterval:60000,queryFn:async()=>{
    const [requirements,assignments]=await Promise.all([
      homeRows(o=>supabase.from('location_requirements').select('location_id,headcount_needed').in('location_id',ids).order('id').range(o,o+499)),
      homeRows(o=>supabase.from('location_assignments').select('location_id,personnel_id').in('location_id',ids).eq('status','active').is('unassigned_at',null).order('id').range(o,o+499)),
    ]);
    const demob=await demobilizedFilter(assignments);
    return Object.fromEntries(ids.map(id=>[id,{
      needed:requirements.filter(r=>r.location_id===id).reduce((n,r)=>n+(r.headcount_needed||0),0),
      assigned:assignments.filter(r=>r.location_id===id&&!demob(r)).length,
    }]));
  }});
}