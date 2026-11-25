import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export type DeploymentHourRow = { id: string; personnel_id: string | null; location_id: string | null; hours: number; entry_date: string; billable: boolean; visit_personnel_id: string | null; in_at?: string | null; out_at?: string | null };
export function useDeploymentHours(projectId?: string, from?: string, to?: string) {
  return useQuery({ queryKey: ['deployment-hours', projectId, from, to], enabled: !!projectId, refetchInterval: 60000, queryFn: async () => {
    const rows: DeploymentHourRow[] = [];
    for (let offset = 0; ; offset += 500) {
      let q = supabase.from('time_entries').select('id,personnel_id,location_id,hours,entry_date,billable,visit_personnel_id').is('voided_at', null).eq('project_id', projectId || '').order('id').range(offset, offset + 499);
      if (from) q = q.gte('entry_date', from); if (to) q = q.lte('entry_date', to);
      const { data, error } = await q; if (error) throw error;
      rows.push(...(data ?? []) as DeploymentHourRow[]); if ((data?.length ?? 0) < 500) break;
    }
    // Stay times (for the 5-minute rule and overlap de-dupe), batched.
    const ids = [...new Set(rows.map(r => r.visit_personnel_id).filter(Boolean))] as string[];
    const times = new Map<string, { in_at: string | null; out_at: string | null }>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase.from('personnel_location_trail').select('visit_personnel_id,in_at,out_at').in('visit_personnel_id', ids.slice(i, i + 200));
      if (error) throw error;
      for (const t of data ?? []) times.set(t.visit_personnel_id, t);
    }
    return rows.map(r => { const t = r.visit_personnel_id ? times.get(r.visit_personnel_id) : undefined; return t ? { ...r, in_at: t.in_at, out_at: t.out_at } : r; });
  }});
}
