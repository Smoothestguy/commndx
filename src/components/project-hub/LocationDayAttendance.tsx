import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Pencil, Plus, AlertTriangle } from 'lucide-react';
import { useLocationAssignments } from '@/integrations/supabase/hooks/useLocationStaffing';
import { EditStayTimesDialog } from '@/components/personnel/lifecycle/EditStayTimesDialog';
import { LogTimeDialog } from '@/components/personnel/lifecycle/LogTimeDialog';
import { localDay } from '@/lib/signinSheets';

type Stay = { id: string; personnel_id: string; name: string; in_at: string; out_at: string | null; hours: number | null; late_minutes: number | null; late_reason: string | null; in_geofence: boolean | null; offsite_reason: string | null; synced_late: boolean | null };
const hm = (iso: string | null, tz: string) => iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—';
const dayLabel = (iso: string, tz: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: tz, month: '2-digit', day: '2-digit' });

/** Day-first attendance for one location: every roster person with in/out, late, geo, totals and manager inline edits. */
export function LocationDayAttendance({ projectId, locationId, timezone, canWrite }: { projectId: string; locationId: string; timezone?: string | null; canWrite: boolean }) {
  const tz = timezone || 'America/Chicago';
  const [day, setDay] = useState(() => localDay(new Date().toISOString(), tz));
  const [edit, setEdit] = useState<{ ids: string[]; name: string; day?: string } | null>(null);
  const [log, setLog] = useState<{ id: string; name: string } | null>(null);
  const { data: roster = [] } = useLocationAssignments(locationId);
  const q = useQuery({
    queryKey: ['visits-window', 'location-day', locationId, day], refetchInterval: 60000,
    queryFn: async () => {
      const base = new Date(`${day}T12:00:00Z`).getTime();
      const [win, open] = await Promise.all([
        supabase.from('personnel_location_trail').select('visit_personnel_id,personnel_id,first_name,last_name,in_at,out_at,hours').eq('location_id', locationId).gte('in_at', new Date(base - 864e5).toISOString()).lte('in_at', new Date(base + 864e5).toISOString()),
        supabase.from('personnel_location_trail').select('visit_personnel_id,personnel_id,first_name,last_name,in_at,out_at,hours').eq('location_id', locationId).is('out_at', null).order('in_at').limit(200),
      ]);
      if (win.error) throw win.error; if (open.error) throw open.error;
      const rows = [...(win.data ?? []).filter(r => r.in_at && localDay(r.in_at, tz) === day), ...(open.data ?? [])];
      const ids = [...new Set(rows.flatMap(r => r.visit_personnel_id ? [r.visit_personnel_id] : []))];
      const meta = ids.length ? await supabase.from('visit_personnel').select('id,late_minutes,late_reason,in_geofence,offsite_reason,synced_late').in('id', ids) : { data: [], error: null };
      if (meta.error) throw meta.error;
      const toStay = (r: typeof rows[number]): Stay => { const m = meta.data?.find(x => x.id === r.visit_personnel_id); return { id: r.visit_personnel_id!, personnel_id: r.personnel_id!, name: [r.first_name, r.last_name].filter(Boolean).join(' '), in_at: r.in_at!, out_at: r.out_at, hours: r.hours, late_minutes: m?.late_minutes ?? null, late_reason: m?.late_reason ?? null, in_geofence: m?.in_geofence ?? null, offsite_reason: m?.offsite_reason ?? null, synced_late: m?.synced_late ?? null }; };
      const dayStays = (win.data ?? []).filter(r => r.visit_personnel_id && r.in_at && localDay(r.in_at, tz) === day).map(toStay);
      const openStays = (open.data ?? []).filter(r => r.visit_personnel_id && r.in_at).map(toStay);
      return { dayStays, openStays };
    },
  });
  const rows = useMemo(() => {
    const stays = q.data?.dayStays ?? [];
    const people = new Map<string, { id: string; name: string; role: string | null; stays: Stay[] }>();
    for (const a of roster) people.set(a.personnel_id, { id: a.personnel_id, name: [a.personnel?.first_name, a.personnel?.last_name].filter(Boolean).join(' '), role: a.role_label, stays: [] });
    for (const s of stays) { const p = people.get(s.personnel_id) ?? { id: s.personnel_id, name: s.name, role: null, stays: [] }; p.stays.push(s); people.set(s.personnel_id, p); }
    return [...people.values()].map(p => ({ ...p, stays: p.stays.sort((a, b) => a.in_at.localeCompare(b.in_at)) })).sort((a, b) => (a.stays[0]?.in_at ?? 'z').localeCompare(b.stays[0]?.in_at ?? 'z') || a.name.localeCompare(b.name));
  }, [roster, q.data]);
  const today = localDay(new Date().toISOString(), tz);
  const stale = (q.data?.openStays ?? []).filter(s => localDay(s.in_at, tz) < today);
  const present = rows.filter(r => r.stays.length).length;
  const total = rows.reduce((s, r) => s + r.stays.reduce((h, x) => h + (x.out_at ? Number(x.hours) || 0 : 0), 0), 0);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <div><label htmlFor="att-day" className="text-sm block">Date</label><Input id="att-day" type="date" className="w-44" value={day} onChange={e => e.target.value && setDay(e.target.value)} /></div>
      <p className="text-sm text-muted-foreground pb-2">{present}/{rows.length} signed in · {total.toFixed(2)} h closed</p>
    </div>
    {stale.length > 0 && <div className="rounded-md border border-warning/50 bg-warning/5 p-3 space-y-2" role="region" aria-label="Open punches">
      <p className="text-sm font-medium"><AlertTriangle className="inline h-4 w-4 mr-1 text-warning" />{stale.length} open punch{stale.length === 1 ? '' : 'es'} from earlier days — not counted in hours until closed</p>
      <ul className="divide-y">{stale.map(s => <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 text-sm"><span>{s.name} · in {dayLabel(s.in_at, tz)} {hm(s.in_at, tz)}</span>{canWrite && <Button size="sm" variant="outline" onClick={() => setEdit({ ids: [s.id], name: s.name })}>Close / fix</Button>}</li>)}</ul>
    </div>}
    {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : q.error ? <p role="alert" className="text-sm text-destructive">Attendance could not be loaded.</p> :
      <div className="border rounded-md divide-y">
        <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_5rem_5rem_minmax(0,2fr)_4rem_5.5rem] gap-2 px-3 py-2 text-xs text-muted-foreground"><span>Person</span><span>In</span><span>Out</span><span>Status</span><span className="text-right">Hours</span><span /></div>
        {rows.length === 0 && <p className="p-3 text-sm text-muted-foreground">No one assigned or signed in on this day.</p>}
        {rows.map(r => { const first = r.stays[0], last = r.stays[r.stays.length - 1]; const hrs = r.stays.reduce((h, x) => h + (x.out_at ? Number(x.hours) || 0 : 0), 0); const late = r.stays.find(s => (s.late_minutes ?? 0) > 0);
          return <div key={r.id} className="grid grid-cols-2 sm:grid-cols-[minmax(0,2fr)_5rem_5rem_minmax(0,2fr)_4rem_5.5rem] gap-x-2 gap-y-1 px-3 py-2 items-center text-sm">
            <span className="col-span-2 sm:col-span-1 font-medium truncate">{r.name || 'Unnamed'}{r.role && <span className="text-xs text-muted-foreground font-normal"> · {r.role}</span>}</span>
            <span className="tabular-nums"><span className="sm:hidden text-muted-foreground">In </span>{first ? hm(first.in_at, tz) : '—'}</span>
            <span className="tabular-nums"><span className="sm:hidden text-muted-foreground">Out </span>{last ? (last.out_at ? hm(last.out_at, tz) : <span className="text-warning">open</span>) : '—'}</span>
            <span className="col-span-2 sm:col-span-1 flex flex-wrap gap-1">
              {!first && <Badge variant="outline" className="text-muted-foreground">Not signed in</Badge>}
              {late ? <Badge variant="outline" className="text-destructive border-destructive/40" title={late.late_reason || undefined}>LATE {late.late_minutes}m{late.late_reason ? ` · ${late.late_reason}` : ''}</Badge> : first && <Badge variant="outline" className="text-success border-success/40">On time</Badge>}
              {r.stays.some(s => s.in_geofence === false || s.offsite_reason) ? <Badge variant="outline" className="text-warning border-warning/40" title={r.stays.find(s => s.offsite_reason)?.offsite_reason || undefined}>Off-site</Badge> : r.stays.some(s => s.in_geofence) ? <Badge variant="outline">In geofence</Badge> : null}
              {r.stays.length > 1 && <Badge variant="outline">{r.stays.length} stays</Badge>}
              {r.stays.some(s => s.synced_late) && <Badge variant="outline">synced late</Badge>}
            </span>
            <span className="tabular-nums sm:text-right">{first ? hrs.toFixed(2) : '—'}</span>
            <span className="sm:text-right">{canWrite && (first
              ? <Button size="sm" variant="ghost" onClick={() => setEdit({ ids: r.stays.map(s => s.id), name: r.name, day })} aria-label={`Edit times for ${r.name}`}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
              : <Button size="sm" variant="ghost" onClick={() => setLog({ id: r.id, name: r.name })} aria-label={`Set arrival for ${r.name}`}><Plus className="h-4 w-4 mr-1" />Arrival</Button>)}</span>
          </div>; })}
      </div>}
    {edit && <EditStayTimesDialog projectId={projectId} ids={edit.ids} personName={edit.name} day={edit.day} onClose={() => { setEdit(null); void q.refetch(); }} />}
    {log && <LogTimeDialog open onOpenChange={o => { if (!o) { setLog(null); void q.refetch(); } }} projectId={projectId} personnelId={log.id} personName={log.name} locationId={locationId} defaultDate={day} />}
  </div>;
}
