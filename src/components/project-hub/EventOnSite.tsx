import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { ProjectLocation } from '@/integrations/supabase/hooks/useProjectLocations';
import { onSiteNow, type OpenStay } from '@/lib/eventOverview';
import { projectBadge, crewDayPath } from '@/lib/phoneToday';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const fmtLocal = (iso: string, zone: string | null | undefined) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone || 'America/Chicago', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return { date: `${p.month}/${p.day}`, time: `${p.hour}${p.minute}` };
};

export function EventOnSite({ projectId, locations }: { projectId: string; locations: ProjectLocation[] }) {
  const [open, setOpen] = useState(false);
  const zones = Object.fromEntries(locations.map(l => [l.id, l.timezone]));
  const byId = new Map(locations.map(l => [l.id, l]));
  const q = useQuery({ queryKey: ['event-on-site', projectId], refetchInterval: 60000, queryFn: async () => {
    const since = new Date(Date.now() - 36 * 3600000).toISOString(), rows: OpenStay[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from('personnel_location_trail').select('visit_personnel_id,personnel_id,first_name,last_name,location_id,in_at,out_at').eq('project_id', projectId).or(`out_at.is.null,in_at.gte.${since}`).order('visit_personnel_id').range(offset, offset + 999);
      if (error) throw error;
      for (const r of data ?? []) if (r.in_at) rows.push({ visit_personnel_id: r.visit_personnel_id, personnel_id: r.personnel_id, name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || 'Unknown', location_id: r.location_id, in_at: r.in_at, out_at: r.out_at });
      if ((data?.length ?? 0) < 1000) break;
    }
    // Auto-closed flag (best effort; open-stay rule still applies without it).
    const openIds = rows.filter(r => !r.out_at).map(r => r.visit_personnel_id);
    for (let i = 0; i < openIds.length; i += 200) {
      const { data } = await supabase.from('visit_personnel').select('id,auto_closed_at').in('id', openIds.slice(i, i + 200));
      const m = new Map((data ?? []).map((d: { id: string; auto_closed_at: string | null }) => [d.id, d.auto_closed_at]));
      for (const r of rows) if (m.has(r.visit_personnel_id)) r.auto_closed_at = m.get(r.visit_personnel_id);
    }
    return rows;
  }});
  if (q.error) return <section><h2 className="font-semibold mb-2">People on site now</h2><p role="alert" className="text-destructive">Unavailable</p></section>;
  const r = q.data ? onSiteNow(q.data, zones, Date.now()) : null;
  const siteLabel = (id: string) => { const l = byId.get(id); return l ? projectBadge('', l.name) || l.name : 'Unknown site'; };
  const breakdown = r ? Object.entries(r.bySite).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${siteLabel(id)} · ${n}`).join(', ') : '';
  return <section className="space-y-1">
    <h2 className="font-semibold" title="Open clock-ins that started within the last 18 hours and were not auto-closed. Each person counts once.">People on site now</h2>
    <button type="button" className="text-left w-full rounded-md hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 disabled:opacity-100" disabled={!r} onClick={() => setOpen(true)} aria-label="Show people on site now">
      <span className="text-3xl font-semibold">{r ? r.count : '…'}</span>
      {r && <span className="ml-2 text-sm text-muted-foreground">Clocked in today: {r.clockedInToday}</span>}
      {breakdown && <span className="block text-xs text-muted-foreground">{breakdown}</span>}
    </button>
    {r && r.stale.length > 0 && <p className="text-xs text-warning">{r.stale.length} open punch{r.stale.length === 1 ? '' : 'es'} from an earlier day ({r.stale.slice(0, 3).map((s, i) => { const t = fmtLocal(s.in_at, zones[s.location_id || '']), l = byId.get(s.location_id || ''); return <span key={s.visit_personnel_id}>{i ? ', ' : ''}{l ? <Link className="underline" to={crewDayPath(l)}>{s.name}, {t.date} {t.time}</Link> : `${s.name}, ${t.date} ${t.time}`}</span>; })}{r.stale.length > 3 ? ', …' : ''}) — not counted</p>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>On site now · {r?.count ?? 0}</DialogTitle></DialogHeader>
      {r && !r.people.length ? <p className="text-sm text-muted-foreground">Nobody is clocked in right now.</p> :
      <ul className="max-h-[60vh] overflow-y-auto divide-y">{r?.people.map(s => { const t = fmtLocal(s.in_at, zones[s.location_id || '']), l = byId.get(s.location_id || ''); return <li key={s.visit_personnel_id} className="flex items-center justify-between gap-2 py-2 text-sm"><span className="truncate">{s.personnel_id ? <Link className="hover:underline" to={`/personnel/${s.personnel_id}`}>{s.name}</Link> : s.name}</span><span className="shrink-0 text-muted-foreground">in {t.time}{t.date !== fmtLocal(new Date().toISOString(), zones[s.location_id || '']).date ? ` (${t.date})` : ''} · {l ? <Link className="hover:underline" to={crewDayPath(l)}>{siteLabel(l.id)}</Link> : '—'}</span></li>; })}</ul>}
    </DialogContent></Dialog>
  </section>;
}
