import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { AUTO_TEXT_SETTING_KEY, AUTO_TEXT_TYPES, parseAutoTextSettings, type AutoTextSettings, type AutoTextType } from '@/lib/autoTexts';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';
const key = ['auto-text-settings'];
export function useAutoTextSettings() {
  const { isAdmin } = useUserRole(), qc = useQueryClient();
  const query = useQuery({ queryKey: key, staleTime: 30000, queryFn: async () => {
    const r = await supabase.from('integration_settings').select('id,setting_value').eq('setting_key', AUTO_TEXT_SETTING_KEY).maybeSingle();
    if (r.error) throw r.error; return parseAutoTextSettings(r.data?.setting_value);
  } });
  const save = useMutation({ mutationFn: async (change: (s: AutoTextSettings) => AutoTextSettings) => {
    if (!isAdmin) throw new Error('Admin access required');
    const r = await supabase.from('integration_settings').select('id,setting_value').eq('setting_key', AUTO_TEXT_SETTING_KEY).maybeSingle();
    if (r.error) throw r.error;
    const prev = parseAutoTextSettings(r.data?.setting_value), next = change(prev);
    const value = next as unknown as Json;
    const w = r.data ? await supabase.from('integration_settings').update({ setting_value: value }).eq('id', r.data.id) : await supabase.from('integration_settings').insert({ setting_key: AUTO_TEXT_SETTING_KEY, setting_value: value });
    if (w.error) throw w.error;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('audit_logs').insert({ user_id: user.id, user_email: user.email || 'unknown', action_type: 'auto_text_settings_update', resource_type: 'integration_settings', resource_id: r.data?.id ?? null, metadata: { previous: prev, next } as unknown as Json, success: true });
    return next;
  }, onSuccess: s => qc.setQueryData(key, s), onError: (e: Error) => toast.error(e.message) });
  return { settings: query.data, isLoading: query.isLoading, error: query.error, save, isAdmin };
}
/** Successful automatic texts per type in the last 7 days (alert_log). */
export function useAutoTextSentCounts(enabled = true) {
  return useQuery({ queryKey: ['auto-text-sent-7d'], enabled, staleTime: 60000, queryFn: async () => {
    const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const out = {} as Record<AutoTextType, number>;
    await Promise.all(AUTO_TEXT_TYPES.map(async t => {
      const pattern = t.kinds[0];
      let q = supabase.from('alert_log').select('id', { count: 'exact', head: true }).gte('alert_date', since).like('detail', 'SMS sent%');
      q = pattern.endsWith('%') ? q.like('kind', pattern) : q.eq('kind', pattern);
      const r = await q; if (r.error) throw r.error; out[t.key] = r.count ?? 0;
    }));
    return out;
  } });
}
