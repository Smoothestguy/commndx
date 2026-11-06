import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export function useDeploymentHours(projectId?: string, from?: string, to?: string) {
  return useQuery({ queryKey: ['deployment-hours', projectId, from, to], enabled: !!projectId, refetchInterval: 60000, queryFn: async () => {
    const rows: { personnel_id: string | null; location_id: string | null; hours: number; entry_date: string; billable: boolean }[] = [];
    for (let offset = 0; ; offset += 500) {
      let q = supabase.from('time_entries').select('personnel_id,location_id,hours,entry_date,billable').eq('project_id', projectId || '').order('id').range(offset, offset + 499);
      if (from) q = q.gte('entry_date', from); if (to) q = q.lte('entry_date', to);
      const { data, error } = await q; if (error) throw error;
      rows.push(...data ?? []); if ((data?.length ?? 0) < 500) return rows;
    }
  }});
}