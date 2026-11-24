import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const OVERLAP_BYPASS_KEY = ['overlap-bypass'];
const read = async () => {
  const { data, error } = await supabase.from('integration_settings').select('id,setting_value').eq('setting_key', 'app_modules').maybeSingle();
  if (error) throw error;
  const value = data?.setting_value && typeof data.setting_value === 'object' && !Array.isArray(data.setting_value) ? data.setting_value as Record<string, unknown> : {};
  return { id: data?.id as string | undefined, value };
};
/** Active global overlap bypass end (ISO) or null; expires automatically. */
export async function activeOverlapBypassUntil(): Promise<string | null> {
  const until = (await read()).value.overlap_bypass_until;
  return typeof until === 'string' && Date.parse(until) > Date.now() ? until : null;
}
export function useOverlapBypass(enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: OVERLAP_BYPASS_KEY, enabled, staleTime: 30000, queryFn: activeOverlapBypassUntil });
  const set = useMutation({
    mutationFn: async (on: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in required');
      const { data: roles, error: re } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      if (re) throw re;
      if (!roles?.some(r => r.role === 'admin' || r.role === 'manager')) throw new Error('Manager access required');
      const until = on ? new Date(Date.now() + 48 * 3600e3).toISOString() : null;
      const row = await read();
      const next = { ...row.value, overlap_bypass_until: until } as unknown as import('@/integrations/supabase/types').Json;
      const result = row.id ? await supabase.from('integration_settings').update({ setting_value: next }).eq('id', row.id) : await supabase.from('integration_settings').insert({ setting_key: 'app_modules', setting_value: next });
      if (result.error) throw result.error;
      await supabase.from('audit_logs').insert({ user_id: user.id, user_email: user.email || 'unknown', action_type: on ? 'overlap_bypass_set' : 'overlap_bypass_clear', resource_type: 'integration_settings', resource_id: row.id ?? null, metadata: { overlap_bypass_until: until, previous_until: (row.value.overlap_bypass_until as string | null) ?? null, set_by: user.id }, success: true });
      return until;
    },
    onSuccess: until => qc.setQueryData(OVERLAP_BYPASS_KEY, until),
  });
  return { until: query.data ?? null, set };
}
