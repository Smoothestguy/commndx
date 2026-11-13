import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import { homeRows } from './useHomeOperations';
import { localDay, midnight, nextDay } from '@/lib/signinSheets';
import { pendingInboxCount } from '@/lib/mobileOperations';

export function useMobileApprovals(enabled = true) {
  const { isAdmin, isManager } = useUserRole();
  return useQuery({queryKey:['mobile-approvals'],enabled:enabled&&(isAdmin||isManager),staleTime:30000,refetchInterval:60000,queryFn:async()=>{
    const projects = await homeRows(o=>supabase.from('projects').select('id,name').is('archived_at',null).order('id').range(o,o+499));
    const locations = await homeRows(o=>supabase.from('project_locations').select('id,name,project_id,timezone,status').order('id').range(o,o+499));
    const [joins,shifts,requests,orders,trail] = await Promise.all([
      homeRows(o=>supabase.from('project_join_requests').select('id,project_id,location_id,first_name,last_name,status').eq('status','pending').order('id').range(o,o+499)),
      homeRows(o=>supabase.from('shift_extensions').select('id,location_id,personnel_id,reason,until_at,status').eq('status','pending').order('id').range(o,o+499)),
      homeRows(o=>supabase.from('location_requests').select('id,location_id,label,kind,qty,note,status').eq('status','open').order('id').range(o,o+499)),
      homeRows(o=>supabase.from('location_task_orders').select('id,location_id,to_number,effective_date,kind,notes,status,location_task_order_lines(label,qty_delta,line_kind)').eq('status','submitted').order('id').range(o,o+499)),
      homeRows(o=>supabase.from('personnel_location_trail').select('visit_personnel_id,personnel_id,location_id,in_at,out_at,signature_url').gte('in_at',new Date(Date.now()-2*86400000).toISOString()).order('visit_personnel_id').range(o,o+499)),
    ]);
    const early = await homeRows(o=>supabase.from('visit_personnel').select('id,visit_id').not('early_in_reason','is',null).is('offsite_approved_at',null).order('id').range(o,o+499));
    const signatures = locations.flatMap(l=>{
      const zone=l.timezone||'America/Chicago',day=localDay(new Date().toISOString(),zone);
      const people=new Map<string,boolean>();
      for(const r of trail)if(r.location_id===l.id&&r.personnel_id&&r.in_at&&Date.parse(r.in_at)>=midnight(day,zone)&&Date.parse(r.in_at)<midnight(nextDay(day),zone))people.set(r.personnel_id,!!r.signature_url||!!people.get(r.personnel_id));
      const count=[...people.values()].filter(v=>!v).length;
      return count?[{locationId:l.id,day,count}]:[];
    });
    return {projects,locations,joins,shifts,requests,orders,signatures,count:pendingInboxCount({joins,shifts:[...shifts,...early],requests,orders,signatures})};
  }});
}