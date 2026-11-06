import { MissingSignatures } from '@/components/signin/MissingSignatures';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Time24Input } from '@/components/ui/time24-input';
import { Loader2, Pencil, Plus, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLogManualTime } from '@/integrations/supabase/hooks/useFieldMode';
import { useEditStayTimes, type StayChange } from '@/hooks/useEditStayTimes';
import { EditStayTimesDialog } from '@/components/personnel/lifecycle/EditStayTimesDialog';
import { LogTimeDialog } from '@/components/personnel/lifecycle/LogTimeDialog';
import { localDay, localTime, midnight, nextDay } from '@/lib/signinSheets';
import { locationTimeIso } from '@/lib/manualTime';
import { isHHmm } from '@/lib/assignmentRoles';
import { LATE_ACK_PRESETS, lateAckText } from '@/lib/lateAck';
import { cn } from '@/lib/utils';

type Stay = { id: string; personnel_id: string; name: string; in_at: string; out_at: string | null; hours: number | null; late_minutes: number | null; late_reason: string | null; late_ack_reason: string | null; in_geofence: boolean | null; offsite_reason: string | null; synced_late: boolean | null };
const hm = (iso: string | null, tz: string) => iso ? localTime(iso, tz) : '—';
const dayLabel = (iso: string, tz: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: tz, month: '2-digit', day: '2-digit' });

/** Day-first attendance for one location: every roster person with in/out, late, geo, totals and manager inline/bulk edits. */
export function LocationDayAttendance({ projectId, locationId, timezone, canWrite }: { projectId: string; locationId: string; timezone?: string | null; canWrite: boolean }) {
  const tz = timezone || 'America/Chicago';
  const [day, setDay] = useState(() => localDay(new Date().toISOString(), tz));
  const [edit, setEdit] = useState<{ ids: string[]; name: string; day?: string } | null>(null);
  const [log, setLog] = useState<{ id: string; name: string } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ date: string; inTime: string; outTime: string; note: string } | null>(null);
  const [ack, setAck] = useState<{ stay: Stay; preset: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const editTimes = useEditStayTimes(projectId);
  const logTime = useLogManualTime(projectId);
  // Roster AS OF the chosen day: assignment period must cover that local day (removed/added people respect their dates).
  const { data: roster = [] } = useQuery({
    queryKey: ['location-assignments', 'as-of', locationId, day],
    queryFn: async () => {
      const start = new Date(midnight(day, tz)).toISOString(), end = new Date(midnight(nextDay(day), tz)).toISOString();
      const { data, error } = await supabase.from('location_assignments').select('personnel_id,role_label,assigned_at,unassigned_at').eq('location_id', locationId).lt('assigned_at', end).or(`unassigned_at.is.null,unassigned_at.gt.${start}`);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map(r => r.personnel_id))];
      const dir = ids.length ? await supabase.from('personnel_directory').select('id,first_name,last_name').in('id', ids) : { data: [], error: null };
      if (dir.error) throw dir.error;
      return (data ?? []).map(r => { const d = dir.data?.find(x => x.id === r.personnel_id); return { personnel_id: r.personnel_id, role_label: r.role_label, personnel: { first_name: d?.first_name ?? null, last_name: d?.last_name ?? null } }; });
    },
  });
  const q = useQuery({
    queryKey: ['visits-window', 'location-day', locationId, day], refetchInterval: 60000,
    queryFn: async () => {
      const base = new Date(`${day}T12:00:00Z`).getTime();
      const [win, open] = await Promise.all([
        supabase.from('personnel_location_trail').select('visit_personnel_id,personnel_id,first_name,last_name,in_at,out_at,hours,signature_url').eq('location_id', locationId).gte('in_at', new Date(base - 864e5).toISOString()).lte('in_at', new Date(base + 864e5).toISOString()),
        supabase.from('personnel_location_trail').select('visit_personnel_id,personnel_id,first_name,last_name,in_at,out_at,hours').eq('location_id', locationId).is('out_at', null).order('in_at').limit(200),
      ]);
      if (win.error) throw win.error; if (open.error) throw open.error;
      const rows = [...(win.data ?? []).filter(r => r.in_at && localDay(r.in_at, tz) === day), ...(open.data ?? [])];
      const ids = [...new Set(rows.flatMap(r => r.visit_personnel_id ? [r.visit_personnel_id] : []))];
      const meta = ids.length ? await supabase.from('visit_personnel').select('id,late_minutes,late_reason,late_ack_reason,in_geofence,offsite_reason,synced_late').in('id', ids) : { data: [], error: null };
      if (meta.error) throw meta.error;
      const toStay = (r: typeof rows[number]): Stay => { const m = meta.data?.find(x => x.id === r.visit_personnel_id); return { id: r.visit_personnel_id!, personnel_id: r.personnel_id!, name: [r.first_name, r.last_name].filter(Boolean).join(' '), in_at: r.in_at!, out_at: r.out_at, hours: r.hours, late_minutes: m?.late_minutes ?? null, late_reason: m?.late_reason ?? null, late_ack_reason: m?.late_ack_reason ?? null, in_geofence: m?.in_geofence ?? null, offsite_reason: m?.offsite_reason ?? null, synced_late: m?.synced_late ?? null }; };
      const dayStays = (win.data ?? []).filter(r => r.visit_personnel_id && r.in_at && localDay(r.in_at, tz) === day).map(toStay);
      const openStays = (open.data ?? []).filter(r => r.visit_personnel_id && r.in_at).map(toStay);
      const sigRows = (win.data ?? []).filter(r => r.personnel_id && r.in_at && localDay(r.in_at, tz) === day).map(r => ({ personnelId: r.personnel_id!, name: [r.first_name, r.last_name].filter(Boolean).join(' '), signature: r.signature_url }));
      return { dayStays, openStays, sigRows };
    },
  });
  const rows = useMemo(() => {
    const stays = q.data?.dayStays ?? [];
    const people = new Map<string, { id: string; name: string; role: string | null; stays: Stay[]; offRoster?: boolean }>();
    for (const a of roster) people.set(a.personnel_id, { id: a.personnel_id, name: [a.personnel?.first_name, a.personnel?.last_name].filter(Boolean).join(' '), role: a.role_label, stays: [] });
    for (const s of stays) { const p = people.get(s.personnel_id) ?? { id: s.personnel_id, name: s.name, role: null, stays: [], offRoster: true }; p.stays.push(s); people.set(s.personnel_id, p); }
    return [...people.values()].map(p => ({ ...p, stays: p.stays.sort((a, b) => a.in_at.localeCompare(b.in_at)) })).sort((a, b) => (a.stays[0]?.in_at ?? 'z').localeCompare(b.stays[0]?.in_at ?? 'z') || a.name.localeCompare(b.name));
  }, [roster, q.data]);
  const today = localDay(new Date().toISOString(), tz);
  const stale = (q.data?.openStays ?? []).filter(s => localDay(s.in_at, tz) < today);
  const present = rows.filter(r => r.stays.length).length;
  const total = rows.reduce((s, r) => s + r.stays.reduce((h, x) => h + (x.out_at ? Number(x.hours) || 0 : 0), 0), 0);
  const allSel = rows.length > 0 && rows.every(r => sel.has(r.id));
  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const COLS = canWrite ? 'sm:grid-cols-[1.75rem_minmax(0,2fr)_4.5rem_4.5rem_minmax(0,2fr)_4rem_5.5rem]' : 'sm:grid-cols-[minmax(0,2fr)_4.5rem_4.5rem_minmax(0,2fr)_4rem]';

  const runBulk = async () => {
    if (!bulk) return;
    const inAt = bulk.inTime ? locationTimeIso(bulk.date, bulk.inTime, tz) : null;
    let outAt = bulk.outTime ? locationTimeIso(bulk.date, bulk.outTime, tz) : null;
    if (inAt && outAt && outAt <= inAt) outAt = locationTimeIso(new Date(Date.parse(`${bulk.date}T12:00:00Z`) + 864e5).toISOString().slice(0, 10), bulk.outTime, tz); // overnight
    const note = bulk.note.trim() || undefined;
    const changes: StayChange[] = []; const create: { id: string; name: string }[] = []; const skipped: string[] = [];
    // Only stays that STARTED on this day are touched. Never fall back to open punches from
    // other days: that once moved today's running check-ins into the previous day.
    if (bulk.date !== day) { toast.error('Bulk times apply to the day being viewed'); return; }
    for (const r of rows.filter(r => sel.has(r.id))) {
      const stays = r.stays.filter(s => localDay(s.in_at, tz) === bulk.date);
      if (!stays.length) { if (inAt && outAt) create.push(r); else skipped.push(r.name); continue; }
      const first = stays[0], last = stays[stays.length - 1];
      if (stays.length === 1) { const nIn = inAt ?? first.in_at, nOut = outAt ?? first.out_at; if (nOut && Date.parse(nOut) <= Date.parse(nIn)) { skipped.push(r.name); continue; } changes.push({ id: first.id, inAt: nIn, outAt: nOut, remove: false, note }); continue; }
      if (inAt) { if (first.out_at && Date.parse(first.out_at) <= Date.parse(inAt)) { skipped.push(r.name); continue; } changes.push({ id: first.id, inAt, outAt: first.out_at, remove: false, note }); }
      if (outAt) { if (Date.parse(outAt) <= Date.parse(last.in_at)) { skipped.push(r.name); continue; } changes.push({ id: last.id, inAt: last.in_at, outAt, remove: false, note }); }
    }
    setBusy(true);
    try {
      if (changes.length) await editTimes.mutateAsync(changes);
      let made = 0; const failed: string[] = [];
      for (const p of create) { try { await logTime.mutateAsync({ personnel_id: p.id, location_id: locationId, day: bulk.date, in_at: inAt!, out_at: outAt!, note: note ?? 'Bulk time entry' }); made++; } catch { failed.push(p.name); } }
      toast.success(`Updated ${changes.length} stay(s)${made ? `, created ${made}` : ''}`);
      if (skipped.length || failed.length) toast.warning(`Not changed: ${[...skipped, ...failed].join(', ')}`);
      setBulk(null); setSel(new Set()); void q.refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Bulk edit failed'); }
    finally { setBusy(false); }
  };

  const saveAck = async () => {
    if (!ack) return;
    const reason = lateAckText(ack.preset, ack.text);
    if (!reason) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('visit_personnel').update({ late_ack_reason: reason, late_ack_by: user?.id ?? null, late_ack_at: new Date().toISOString() }).eq('id', ack.stay.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Late check-in acknowledged'); setAck(null); void q.refetch();
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <div><label htmlFor="att-day" className="text-sm block">Date</label><Input id="att-day" type="date" className="w-44" value={day} onChange={e => { if (e.target.value) { setDay(e.target.value); setSel(new Set()); } }} /></div>
      <p className="text-sm text-muted-foreground pb-2">{present}/{rows.length} signed in · {total.toFixed(2)} h closed</p>
      {canWrite && <Button className="ml-auto" size="sm" variant="outline" disabled={!sel.size} onClick={() => setBulk({ date: day, inTime: '', outTime: '', note: '' })}><Clock className="h-4 w-4 mr-1" />Set times for {sel.size || ''} selected</Button>}
    </div>
    {stale.length > 0 && <div className="rounded-md border border-warning/50 bg-warning/5 p-3 space-y-2" role="region" aria-label="Open punches">
      <p className="text-sm font-medium"><AlertTriangle className="inline h-4 w-4 mr-1 text-warning" />{stale.length} open punch{stale.length === 1 ? '' : 'es'} from earlier days — not counted in hours until closed</p>
      <ul className="divide-y">{stale.map(s => <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 text-sm"><span>{s.name} · in {dayLabel(s.in_at, tz)} {hm(s.in_at, tz)}</span>{canWrite && <Button size="sm" variant="outline" onClick={() => setEdit({ ids: [s.id], name: s.name })}>Close / fix</Button>}</li>)}</ul>
    </div>}
    {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : q.error ? <p role="alert" className="text-sm text-destructive">Attendance could not be loaded.</p> :
      <div className="border rounded-md divide-y">
        <div className={cn('hidden sm:grid gap-2 px-3 py-2 text-xs text-muted-foreground items-center', COLS)}>{canWrite && <Checkbox aria-label="Select all" checked={allSel} onCheckedChange={() => setSel(allSel ? new Set() : new Set(rows.map(r => r.id)))} />}<span>Person</span><span>In</span><span>Out</span><span>Status</span><span className="text-right">Hours</span>{canWrite && <span />}</div>
        {canWrite && rows.length > 0 && <label className="sm:hidden flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><Checkbox checked={allSel} onCheckedChange={() => setSel(allSel ? new Set() : new Set(rows.map(r => r.id)))} />Select all</label>}
        {rows.length === 0 && <p className="p-3 text-sm text-muted-foreground">No one assigned or signed in on this day.</p>}
        {rows.map(r => { const first = r.stays[0], last = r.stays[r.stays.length - 1]; const hrs = r.stays.reduce((h, x) => h + (x.out_at ? Number(x.hours) || 0 : 0), 0); const late = r.stays.find(s => (s.late_minutes ?? 0) > 0);
          const lateTip = late ? [late.late_reason && `Worker: ${late.late_reason}`, late.late_ack_reason && `Approved: ${late.late_ack_reason}`].filter(Boolean).join(' · ') : '';
          return <div key={r.id} className={cn('grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-1 px-3 py-2 items-center text-sm', COLS, sel.has(r.id) && 'bg-primary/5')}>
            {canWrite && <Checkbox aria-label={`Select ${r.name}`} checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} className="row-span-2 sm:row-span-1" />}
            <span className="col-span-2 sm:col-span-1 font-medium truncate">{r.name || 'Unnamed'}{r.role && <span className="text-xs text-muted-foreground font-normal"> · {r.role}</span>}</span>
            <span className="tabular-nums"><span className="sm:hidden text-muted-foreground">In </span>{first ? hm(first.in_at, tz) : '—'}</span>
            <span className="tabular-nums"><span className="sm:hidden text-muted-foreground">Out </span>{last ? (last.out_at ? hm(last.out_at, tz) : <span className="text-warning">open</span>) : '—'}</span>
            <span className="col-span-3 sm:col-span-1 flex flex-wrap gap-1">
              {!first && <Badge variant="outline" className="text-muted-foreground">Not signed in</Badge>}
              {r.offRoster && <Badge variant="outline" className="bg-muted text-muted-foreground" title="Has time here this day but was not assigned to this site on this date">Not on roster this day</Badge>}
              {late ? <Badge variant="outline" className={cn(late.late_ack_reason ? 'text-warning border-warning/40' : 'text-destructive border-destructive/40')} title={lateTip || undefined}>LATE {late.late_minutes}m{late.late_reason ? ` · ${late.late_reason}` : ''}{late.late_ack_reason ? ' · approved' : ''}</Badge> : first && <Badge variant="outline" className="text-success border-success/40">On time</Badge>}
              {late && canWrite && <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => setAck({ stay: late, preset: '', text: '' })}><CheckCircle2 className="h-3 w-3 mr-1" />{late.late_ack_reason ? 'Change approval' : 'Approve late'}</Button>}
              {r.stays.some(s => s.in_geofence === false || s.offsite_reason) ? <Badge variant="outline" className="text-warning border-warning/40" title={r.stays.find(s => s.offsite_reason)?.offsite_reason || undefined}>Off-site</Badge> : r.stays.some(s => s.in_geofence) ? <Badge variant="outline">In geofence</Badge> : null}
              {r.stays.length > 1 && <Badge variant="outline">{r.stays.length} stays</Badge>}
              {r.stays.some(s => s.synced_late) && <Badge variant="outline">synced late</Badge>}
            </span>
            <span className="tabular-nums sm:text-right">{first ? hrs.toFixed(2) : '—'}</span>
            {canWrite && <span className="col-span-2 sm:col-span-1 flex justify-end gap-0.5">
              {r.stays.length === 1 && <Button size="sm" variant="ghost" className="px-2" onClick={() => setEdit({ ids: [first.id], name: r.name, day })} aria-label={`Edit times for ${r.name}`}><Pencil className="h-4 w-4" /></Button>}
              <Button size="sm" variant="ghost" className="px-2" onClick={() => setLog({ id: r.id, name: r.name })} aria-label={first ? `Add entry for ${r.name}` : `Set arrival for ${r.name}`} title={first ? 'Add another stay' : 'Set arrival'}><Plus className="h-4 w-4" />{!first && <span className="ml-1">Arrival</span>}</Button></span>}
            {r.stays.length > 1 && <ul className="col-span-full divide-y border-l-2 border-muted ml-1 sm:ml-8" aria-label={`Stays for ${r.name}`}>{r.stays.map((st, i) => <li key={st.id} className="flex items-center gap-3 py-1 pl-3 text-xs tabular-nums">
              <span className="text-muted-foreground w-12">Stay {i + 1}</span><span>{hm(st.in_at, tz)} → {st.out_at ? hm(st.out_at, tz) : <span className="text-warning">open</span>}</span>
              <span className="ml-auto">{st.out_at ? (Number(st.hours) || 0).toFixed(2) + ' h' : '—'}</span>
              {canWrite && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEdit({ ids: [st.id], name: `${r.name} · stay ${i + 1}`, day })} aria-label={`Edit stay ${i + 1} for ${r.name}`}><Pencil className="h-3.5 w-3.5" /></Button>}
            </li>)}</ul>}
          </div>; })}
      </div>}
    {edit && <EditStayTimesDialog projectId={projectId} ids={edit.ids} personName={edit.name} day={edit.day} onClose={() => { setEdit(null); void q.refetch(); }} />}
    {log && <LogTimeDialog open onOpenChange={o => { if (!o) { setLog(null); void q.refetch(); } }} projectId={projectId} personnelId={log.id} personName={log.name} locationId={locationId} defaultDate={day} />}

    <Dialog open={!!bulk} onOpenChange={o => !o && !busy && setBulk(null)}><DialogContent className="max-w-sm max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Set times · {sel.size} selected</DialogTitle></DialogHeader>
      {bulk && <div className="space-y-3">
        <div><Label htmlFor="bulk-date">Date</Label><Input id="bulk-date" type="date" value={bulk.date} readOnly disabled aria-describedby="bulk-date-help" /><p id="bulk-date-help" className="text-xs text-muted-foreground mt-1">Change the day above to edit another date. Running punches from other days are never changed here.</p></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label htmlFor="bulk-in">Time in (24h)</Label><Time24Input id="bulk-in" value={bulk.inTime} onChange={e => setBulk({ ...bulk, inTime: e.target.value })} /></div>
          <div><Label htmlFor="bulk-out">Time out (24h)</Label><Time24Input id="bulk-out" value={bulk.outTime} onChange={e => setBulk({ ...bulk, outTime: e.target.value })} /></div>
        </div>
        <div><Label htmlFor="bulk-note">Note (optional)</Label><Textarea id="bulk-note" rows={2} maxLength={300} value={bulk.note} onChange={e => setBulk({ ...bulk, note: e.target.value })} /></div>
        <p className="text-xs text-muted-foreground">Leave a time blank to keep each person's existing value. People with no stay need both times. Every change is audited. {tz}</p>
      </div>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setBulk(null)}>Cancel</Button>
        <Button disabled={busy || !bulk || !bulk.date || (!bulk.inTime && !bulk.outTime) || (!!bulk.inTime && !isHHmm(bulk.inTime)) || (!!bulk.outTime && !isHHmm(bulk.outTime))} onClick={runBulk}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Apply</Button></DialogFooter>
    </DialogContent></Dialog>

    <Dialog open={!!ack} onOpenChange={o => !o && !busy && setAck(null)}><DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Approve late check-in</DialogTitle></DialogHeader>
      {ack && <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{ack.stay.name} · {ack.stay.late_minutes}m late{ack.stay.late_reason ? ` · worker said "${ack.stay.late_reason}"` : ''}</p>
        <div className="flex flex-wrap gap-1.5">{LATE_ACK_PRESETS.map(p => <Button key={p} type="button" size="sm" variant={ack.preset === p ? 'default' : 'outline'} onClick={() => setAck({ ...ack, preset: ack.preset === p ? '' : p })}>{p}</Button>)}</div>
        <div><Label htmlFor="ack-text">Details</Label><Textarea id="ack-text" rows={2} maxLength={300} value={ack.text} onChange={e => setAck({ ...ack, text: e.target.value })} /></div>
      </div>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setAck(null)}>Cancel</Button><Button disabled={busy || !ack || !lateAckText(ack.preset, ack.text)} onClick={saveAck}>Approve</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
