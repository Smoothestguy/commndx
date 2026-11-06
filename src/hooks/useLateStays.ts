import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { type LateInfo } from '@/lib/lateAttendance';
export function useLateStays(ids: string[]) {
  const keys = [...new Set(ids)].sort();
  return useQuery({ queryKey: ['late-stays', keys], enabled: keys.length > 0, refetchOnWindowFocus: true, refetchInterval: 60000, queryFn: async () => {
    const result: Record<string, LateInfo> = {};
    for (let i = 0; i < keys.length; i += 200) {
      const { data, error } = await supabase.from('visit_personnel').select('id,late_minutes,late_reason').in('id', keys.slice(i, i + 200));
      if (error) throw error;
      for (const row of data ?? []) result[row.id] = { late_minutes: row.late_minutes, late_reason: row.late_reason };
    }
    return result;
  } });
}