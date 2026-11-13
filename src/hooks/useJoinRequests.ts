import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { canReviewJoinRequests } from '@/lib/projectJoin';
export function useJoinRequests(projectId: string) {
  const { user } = useAuth();
  const { role } = useUserRole();
  return useQuery({ queryKey: ['project-join-requests', user?.id, projectId], enabled: !!user && !!projectId && canReviewJoinRequests(role), staleTime: 15_000, refetchOnWindowFocus: 'always', refetchInterval: 30_000, queryFn: async () => {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('project_join_requests').select('id,project_id,location_id,first_name,last_name,phone,requested_at,matched_personnel_id,status,token_id').eq('project_id', projectId).eq('status', 'pending').order('requested_at', { ascending: true }).order('id').range(offset, offset + 499);
      if (error) throw error; rows.push(...data); if (data.length < 500) break;
    }
    const ids = [...new Set(rows.flatMap(r => r.matched_personnel_id ? [r.matched_personnel_id] : []))];
    const names: Record<string, string> = {};
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase.from('personnel_directory').select('id,first_name,last_name').in('id', ids.slice(i, i + 200));
      if (error) throw error;
      for (const p of data || []) if (p.id) names[p.id] = [p.first_name, p.last_name].filter(Boolean).join(' ');
    }
    const tokens=rows.length?await supabase.from('project_join_tokens').select('id,vendor_id').in('id',[...new Set(rows.map(r=>r.token_id))]):{data:[],error:null};if(tokens.error)throw tokens.error;
    const people=ids.length?await supabase.from('personnel').select('id,vendor_id,employer_customer_id').in('id',ids):{data:[],error:null};
    return rows.map(r => {const agency=tokens.data?.find(t=>t.id===r.token_id)?.vendor_id;const p=people.data?.find(p=>p.id===r.matched_personnel_id);return {...r,agency_id:agency??null,current_vendor:p?.vendor_id??null,agency_conflict:!!agency&&!!p&&(p.vendor_id!==agency||!!p.employer_customer_id),matched_name:r.matched_personnel_id?names[r.matched_personnel_id]||`${r.first_name} ${r.last_name}`:null};});
  } });
}
export function useInvalidateJoinApproval() {
  const qc = useQueryClient();
  return () => Promise.all(['mobile-approvals', 'project-join-requests', 'location-assignments', 'location-staffing-summary', 'project-roster', 'personnel-project-assignments', 'project-agencies', 'personnel-current-status', 'personnel-lite-active', 'personnel', 'site-texts', 'personnel-with-assets'].map(key => qc.invalidateQueries({ queryKey: [key] })));
}