import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normTag } from '@/lib/personnelSegment';
import { toast } from 'sonner';

/** All capability tags: personnel_id -> labels, plus distinct label list for type-ahead. */
export function usePersonnelTags() {
  return useQuery({
    queryKey: ['personnel-tags'],
    staleTime: 60_000,
    queryFn: async () => {
      const byPerson: Record<string, string[]> = {};
      const labels = new Map<string, string>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('personnel_capabilities').select('personnel_id, capability').range(from, from + 999);
        if (error) throw error;
        for (const r of data ?? []) {
          const t = normTag(r.capability); if (!t) continue;
          (byPerson[r.personnel_id] ||= []).push(t);
          if (!labels.has(t.toLowerCase())) labels.set(t.toLowerCase(), t);
        }
        if ((data ?? []).length < 1000) break;
      }
      return { byPerson, labels: [...labels.values()].sort((a, b) => a.localeCompare(b)) };
    },
  });
}

export function useAddTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ personnelIds, tag }: { personnelIds: string[]; tag: string }) => {
      const t = normTag(tag); if (!t) throw new Error('Tag is empty');
      const { data: existing } = await supabase.from('personnel_capabilities').select('personnel_id, capability').in('personnel_id', personnelIds);
      const has = new Set((existing ?? []).filter(r => normTag(r.capability).toLowerCase() === t.toLowerCase()).map(r => r.personnel_id));
      const rows = personnelIds.filter(id => !has.has(id)).map(id => ({ personnel_id: id, capability: t }));
      if (rows.length) { const { error } = await supabase.from('personnel_capabilities').insert(rows); if (error) throw error; }
      return rows.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personnel-tags'] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ personnelId, tag }: { personnelId: string; tag: string }) => {
      const { data } = await supabase.from('personnel_capabilities').select('id, capability').eq('personnel_id', personnelId);
      const ids = (data ?? []).filter(r => normTag(r.capability).toLowerCase() === normTag(tag).toLowerCase()).map(r => r.id);
      if (ids.length) { const { error } = await supabase.from('personnel_capabilities').delete().in('id', ids); if (error) throw error; }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personnel-tags'] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Bench / status bulk updates (manager-only; server trigger also guards bench fields). */
export function useBulkPersonnelUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: { on_bench?: boolean; bench_rank?: number | null; bench_note?: string | null; status?: 'active' | 'inactive' | 'do_not_hire' } }) => {
      const { error } = await supabase.from('personnel').update(patch).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['personnel'] }); qc.invalidateQueries({ queryKey: ['personnel-lite-active'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}
