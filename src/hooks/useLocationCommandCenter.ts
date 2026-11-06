import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { localDay } from '@/lib/signinSheets';

export type LocationOps = {
  onSite: number; checkedToday: number; late: number; openPunches: number;
  joinPending: number; pendingTOs: number; extPending: number; lastActivity: string | null;
  next: { kind: string; date: string; labels: { label: string; authorized: number; line_kind: string }[] } | null;
};

async function all<T>(make: (o: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let o = 0; ; o += 1000) { const { data, error } = await make(o); if (error) throw error; out.push(...(data ?? [])); if ((data ?? []).length < 1000) return out; }
}

/** Batched, dollar-free operational snapshot for every location in a project. */
export function useLocationCommandCenter(projectId: string, locations: { id: string; timezone?: string | null }[]) {
  const ids = locations.map(l => l.id).sort();
  return useQuery({
    queryKey: ['location-command-center', projectId, ids], enabled: ids.length > 0, refetchInterval: 60000,
    queryFn: async () => {
      const zone = (id: string) => locations.find(l => l.id === id)?.timezone || 'America/Chicago';
      const today = (id: string) => localDay(new Date().toISOString(), zone(id));
      const since = new Date(Date.now() - 3 * 86400000).toISOString();
      const [recent, open, joins, tos, exts] = await Promise.all([
        all<any>(o => supabase.from('personnel_location_trail').select('visit_personnel_id,personnel_id,location_id,in_at,out_at').eq('project_id', projectId).gte('in_at', since).order('in_at').range(o, o + 999)),
        all<any>(o => supabase.from('personnel_location_trail').select('personnel_id,location_id').eq('project_id', projectId).is('out_at', null).order('in_at').range(o, o + 999)),
        supabase.from('project_join_requests').select('location_id').eq('project_id', projectId).eq('status', 'pending'),
        supabase.from('location_task_orders').select('location_id,kind,effective_date,status').in('location_id', ids),
        supabase.from('shift_extensions').select('location_id').in('location_id', ids).eq('status', 'pending'),
      ]);
      for (const r of [joins, tos, exts]) if (r.error) throw r.error;
      const out: Record<string, LocationOps> = {};
      for (const id of ids) out[id] = { onSite: 0, checkedToday: 0, late: 0, openPunches: 0, joinPending: 0, pendingTOs: 0, extPending: 0, lastActivity: null, next: null };
      const todayRows = recent.filter(t => out[t.location_id] && localDay(t.in_at, zone(t.location_id)) === today(t.location_id));
      const vpIds = todayRows.map(t => t.visit_personnel_id).filter(Boolean);
      const lateIds = new Set<string>();
      for (let i = 0; i < vpIds.length; i += 200) {
        const { data, error } = await supabase.from('visit_personnel').select('id').in('id', vpIds.slice(i, i + 200)).gt('late_minutes', 0);
        if (error) throw error; for (const v of data ?? []) lateIds.add(v.id);
      }
      const people = (rows: any[], loc: string) => new Set(rows.filter(r => r.location_id === loc).map(r => r.personnel_id)).size;
      for (const id of ids) {
        const o = out[id];
        o.checkedToday = people(todayRows, id);
        o.onSite = people(todayRows.filter(t => !t.out_at), id);
        o.late = new Set(todayRows.filter(t => t.location_id === id && lateIds.has(t.visit_personnel_id)).map(t => t.personnel_id)).size;
        o.openPunches = open.filter(t => t.location_id === id).length;
        for (const t of recent) if (t.location_id === id) { const ts = [t.in_at, t.out_at].filter(Boolean).sort().pop(); if (ts && (!o.lastActivity || ts > o.lastActivity)) o.lastActivity = ts; }
      }
      for (const j of joins.data ?? []) if (j.location_id && out[j.location_id]) out[j.location_id].joinPending++;
      for (const e of exts.data ?? []) if (out[e.location_id]) out[e.location_id].extPending++;
      for (const t of tos.data ?? []) if (['submitted', 'pending'].includes(t.status)) out[t.location_id].pendingTOs++;
      await Promise.all(ids.map(async id => {
        const upcoming = (tos.data ?? []).filter(t => t.location_id === id && t.status === 'accepted' && t.effective_date > today(id)).sort((a, b) => a.effective_date.localeCompare(b.effective_date))[0];
        if (!upcoming) return;
        const { data, error } = await supabase.rpc('location_authorized_asof', { p_location: id, p_date: upcoming.effective_date });
        if (error) throw error;
        out[id].next = { kind: upcoming.kind, date: upcoming.effective_date, labels: (data ?? []) as any };
      }));
      return out;
    },
  });
}
