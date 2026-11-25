import { DayStaffingBreakdown } from '@/components/project-hub/DayStaffingBreakdown';
import { MobeSection } from '@/components/signin/MobeSection';
import { EnhancedDataTable, type EnhancedColumn } from '@/components/shared/EnhancedDataTable';
import { useSessionState } from '@/hooks/useSessionState';
import { useTransientSelection } from '@/hooks/useTransientSelection';
import {useAttendanceRoster} from '@/hooks/useAttendanceRoster';
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
import { Loader2, Pencil, Plus, AlertTriangle, Clock, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useLogManualTime } from '@/integrations/supabase/hooks/useFieldMode';
import { useEditStayTimes, type StayChange } from '@/hooks/useEditStayTimes';
import { EditStayTimesDialog } from '@/components/personnel/lifecycle/EditStayTimesDialog';
import { LogTimeDialog } from '@/components/personnel/lifecycle/LogTimeDialog';
import { localDay, localTime, midnight, nextDay } from '@/lib/signinSheets';
import { locationTimeIso } from '@/lib/manualTime';
import { isHHmm } from '@/lib/assignmentRoles';
import { LATE_ACK_PRESETS, lateAckText } from '@/lib/lateAck';
import { punchTimeDetail } from '@/lib/punchTimes';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MessageSquare, MoreHorizontal } from 'lucide-react';
import { useMobeRows } from '@/components/signin/MobeSection';
import { PersonnelBulkActions } from '@/components/personnel/PersonnelBulkActions';
import { useSetStatus } from '@/integrations/supabase/hooks/usePersonnelStatus';
import { useEndAssignment, type LocationAssignment } from '@/integrations/supabase/hooks/useLocationStaffing';
import { crewDaySummary, headcountLine, presenceOnlyCount } from '@/lib/crewSummary';
import { loadExpectedDay, expectedTotal } from '@/lib/locationExpected';
import { isShortStay, pickExpected, resolveRole, overlappingStays } from '@/lib/staffingBreakdown';
import { ExpectedHeadcountEdit } from './ExpectedHeadcountEdit';
import { useUserRole } from '@/hooks/useUserRole';
import { CrewAddToDayDialog } from './CrewAddToDayDialog';
import { NeedActionList, useDayResolutions } from './NeedActionList';
import { needActionIds } from '@/lib/needAction';
import { scheduledShift, manualTimeRange } from '@/lib/manualTime';
import { useProject } from '@/integrations/supabase/hooks/useProjects';
import { useProjectLocations } from '@/integrations/supabase/hooks/useProjectLocations';

export type CrewOptions = {
  agencies: { agencyName: (id: string) => string | null | undefined; employerName: (id: string) => string | null | undefined; nonBillableByPerson: Record<string, boolean | undefined> };
  phones: Record<string, string | null>; assignments: LocationAssignment[]; onText: (ids: string[]) => void; header?: React.ReactNode; onAssign?: () => void; onRequirements?: () => void;
};

/** Inline military time cell: blank = not here; commits on blur/Enter. */
function TimeCell({ value, disabled, label, onCommit }: { value: string; disabled?: boolean; label: string; onCommit: (v: string) => Promise<void> | void }) {
  const [draft, setDraft] = useState(value.replace(':', ''));
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(value.replace(':', '')), [value]);
  const commit = async () => {
    const v = draft.trim();
    if (v === value.replace(':', '')) return;
    if (!v) { setDraft(value.replace(':', '')); return; }
    const d = v.replace(':', '').padStart(4, '0');
    const hhmm = `${d.slice(0, 2)}:${d.slice(2)}`;
    if (!/^\d{4}$/.test(d) || !isHHmm(hhmm)) { toast.error('Use military time 0000–2359'); setDraft(value.replace(':', '')); return; }
    setBusy(true); try { await onCommit(hhmm); } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed'); setDraft(value.replace(':', '')); } finally { setBusy(false); }
  };
  if (disabled) return <span className="tabular-nums">{value.replace(':', '') || '—'}</span>;
  return <Input aria-label={label} inputMode="numeric" maxLength={5} placeholder="—" value={draft} disabled={busy} onChange={e => setDraft(e.target.value.replace(/[^0-9:]/g, ''))} onBlur={() => void commit()} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setDraft(value.replace(':', '')); } }} onClick={e => e.stopPropagation()} className="h-8 w-16 px-1.5 text-center tabular-nums" />;
}

type Stay = { id: string; personnel_id: string; name: string; in_at: string; out_at: string | null; actual_in_at?: string | null; actual_out_at?: string | null;auto_closed_at?:string|null;reported_out_at?:string|null; hours: number | null; late_minutes: number | null; late_reason: string | null; late_ack_reason: string | null; in_geofence: boolean | null; offsite_reason: string | null; synced_late: boolean | null;demobe?:boolean };
const hm = (iso: string | null, tz: string) => iso ? localTime(iso, tz) : '—';
const dayLabel = (iso: string, tz: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: tz, month: '2-digit', day: '2-digit' });

/** Day-first attendance for one location: every roster person with in/out, late, geo, totals and manager inline/bulk edits. */
export function LocationDayAttendance({ projectId, locationId, timezone, canWrite, todayFirst=false, crew }: { projectId: string; locationId: string; timezone?: string | null; canWrite: boolean; todayFirst?:boolean; crew?: CrewOptions }) {
  const mobile=useIsMobile();
  const tz = timezone || 'America/Chicago';
  const [day, setDay] = useSessionState(`attendance:${locationId}:day`, localDay(new Date().toISOString(), tz));
  useEffect(()=>{if(todayFirst)setDay(localDay(new Date().toISOString(),tz));},[locationId,todayFirst]);
  const [edit, setEdit] = useState<{ ids: string[]; name: string; day?: string } | null>(null);
  const [log, setLog] = useState<{ id: string; name: string } | null>(null);
  const [selected, setSelected] = useTransientSelection<string[]>(`attendance:${locationId}:selection`, []);
  const sel = new Set(selected);
  const setSel = (ids: Set<string>) => setSelected([...ids]);
  const [bulk, setBulk] = useState<{ date: string; inTime: string; outTime: string; note: string } | null>(null);
  const [ack, setAck] = useState<{ stay: Stay; preset: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [addPerson, setAddPerson] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const editTimes = useEditStayTimes(projectId);
  const logTime = useLogManualTime(projectId);
  const [addCrew, setAddCrew] = useState(false);
  const { isAdmin } = useUserRole();
  const expected = useQuery({ queryKey: ['location-day-expected', locationId, day], queryFn: () => loadExpectedDay(locationId, day) });
  const {data:roster=[]}=useAttendanceRoster(projectId,locationId,day,tz);
  const linkEvents=useQuery({queryKey:['punch-link-events',locationId,day],enabled:canWrite,refetchInterval:60000,queryFn:async()=>{const result=await supabase.from('punch_link_events').select('id,personnel_id,opened_at,lat,lng,gps_status').eq('location_id',locationId).eq('local_date',day).order('opened_at').limit(500);if(result.error)throw result.error;return result.data;}});
  const q = useQuery({
    queryKey: ['visits-window', 'location-day', locationId, day], refetchInterval: 60000,
    queryFn: async () => {
      const base = new Date(`${day}T12:00:00Z`).getTime();
      const [win, open, pres] = await Promise.all([
        supabase.from('personnel_location_trail').select('visit_personnel_id,personnel_id,first_name,last_name,in_at,out_at,hours,signature_url').eq('project_id',projectId).eq('location_id', locationId).gte('in_at', new Date(base - 864e5).toISOString()).lte('in_at', new Date(base + 864e5).toISOString()),
        supabase.from('personnel_location_trail').select('visit_personnel_id,personnel_id,first_name,last_name,in_at,out_at,hours').eq('project_id',projectId).eq('location_id', locationId).is('out_at', null).order('in_at').limit(200),
        supabase.from('timesheet_presence_signatures').select('personnel_id,signed_at,personnel:personnel_id(first_name,last_name)').eq('location_id', locationId).eq('sign_date', day),
      ]);
      if (win.error) throw win.error; if (open.error) throw open.error;
      const rows = [...(win.data ?? []).filter(r => r.in_at && localDay(r.in_at, tz) === day), ...(open.data ?? [])];
      const ids = [...new Set(rows.flatMap(r => r.visit_personnel_id ? [r.visit_personnel_id] : []))];
      const meta = ids.length ? await supabase.from('visit_personnel').select('id,actual_in_at,actual_out_at,auto_closed_at,reported_out_at,late_minutes,late_reason,late_ack_reason,in_geofence,offsite_reason,synced_late,demobe_task_order_id').in('id', ids) : { data: [], error: null };
      if (meta.error) throw meta.error;
      const toStay = (r: typeof rows[number]): Stay => { const m = meta.data?.find(x => x.id === r.visit_personnel_id); return { id: r.visit_personnel_id ?? '', personnel_id: r.personnel_id ?? '', name: [r.first_name, r.last_name].filter(Boolean).join(' '), in_at: r.in_at ?? '', out_at: r.out_at, actual_in_at: m?.actual_in_at, actual_out_at: m?.actual_out_at,auto_closed_at:m?.auto_closed_at,reported_out_at:m?.reported_out_at, demobe:!!m?.demobe_task_order_id, hours: r.hours, late_minutes: m?.late_minutes ?? null, late_reason: m?.late_reason ?? null, late_ack_reason: m?.late_ack_reason ?? null, in_geofence: m?.in_geofence ?? null, offsite_reason: m?.offsite_reason ?? null, synced_late: m?.synced_late ?? null }; };
      const dayStays = (win.data ?? []).filter(r => r.visit_personnel_id && r.in_at && localDay(r.in_at, tz) === day).map(toStay);
      const openStays = (open.data ?? []).filter(r => r.visit_personnel_id && r.in_at).map(toStay);
      const sigRows = (win.data ?? []).filter(r => r.personnel_id && r.in_at && localDay(r.in_at, tz) === day).map(r => ({ personnelId: r.personnel_id ?? '', name: [r.first_name, r.last_name].filter(Boolean).join(' '), signature: r.signature_url }));
      // Presence-only attestations (dates-only links): no times, never treated as signed time entries.
      const presence = (pres.data ?? []).map((x: any) => ({ personnelId: x.personnel_id as string, name: [x.personnel?.first_name, x.personnel?.last_name].filter(Boolean).join(' ') }));
      return { dayStays, openStays, sigRows, presence };
    },
  });
  const rows = useMemo(() => {
    const stays = q.data?.dayStays ?? [];
    const people = new Map<string, { id: string; name: string; role: string | null; stays: Stay[]; offRoster?: boolean; demobilized?:boolean }>();
    for (const a of roster) people.set(a.personnel_id, { id: a.personnel_id, name: [a.personnel?.first_name, a.personnel?.last_name].filter(Boolean).join(' '), role: a.role_label, stays: [],offRoster:!a.assignedOnDay,demobilized:a.demobilized });
    for (const s of stays) { const p = people.get(s.personnel_id) ?? { id: s.personnel_id, name: s.name, role: null, stays: [], offRoster: true }; p.stays.push(s); people.set(s.personnel_id, p); }
    return [...people.values()].filter(p => !crew || p.stays.length || (!p.demobilized && crew.assignments.some(a => a.personnel_id === p.id))).map(p => ({ ...p, stays: p.stays.sort((a, b) => a.in_at.localeCompare(b.in_at)) })).sort((a, b) => (a.stays[0]?.in_at ?? 'z').localeCompare(b.stays[0]?.in_at ?? 'z') || a.name.localeCompare(b.name));
  }, [roster, q.data, crew]);
  // Staffing accuracy (display only): carry-forward customer sheet, role fallback, short-stay and overlap checks.
  const countable = (r: { stays: Stay[] }) => r.stays.filter(st => !isShortStay(st));
  const presentIds = rows.filter(r => countable(r).length).map(r => r.id);
  const carry = useQuery({ queryKey: ['location-day-expected-carry', locationId, day], queryFn: async () => {
    const [loc, ex] = await Promise.all([
      supabase.from('project_locations').select('mobe_date,demobe_date,closed_at').eq('id', locationId).maybeSingle(),
      supabase.from('location_day_expected').select('day,supervisors,technicians,operators,source').eq('location_id', locationId).lte('day', day).order('day', { ascending: false }).limit(60),
    ]);
    if (ex.error) return null;
    const end = loc.data?.demobe_date ?? (loc.data?.closed_at ? localDay(loc.data.closed_at, tz) : null);
    return pickExpected(ex.data ?? [], day, { start: loc.data?.mobe_date ?? null, end });
  } });
  const noRoleIds = rows.filter(r => !r.role?.trim() && countable(r).length).map(r => r.id);
  const roleHistory = useQuery({ queryKey: ['role-history', noRoleIds.join(',')], enabled: noRoleIds.length > 0, queryFn: async () => {
    const res = await supabase.from('location_assignments').select('personnel_id,role_label,assigned_at').in('personnel_id', noRoleIds).not('role_label', 'is', null).limit(1000);
    if (res.error) throw res.error; return res.data ?? [];
  } });
  const otherSites = useQuery({ queryKey: ['other-site-stays', locationId, day, presentIds.join(',')], enabled: presentIds.length > 0, queryFn: async () => {
    const base = new Date(`${day}T12:00:00Z`).getTime();
    const res = await supabase.from('personnel_location_trail').select('personnel_id,location_id,location_name,in_at,out_at').in('personnel_id', presentIds).neq('location_id', locationId).gte('in_at', new Date(base - 2 * 864e5).toISOString()).lte('in_at', new Date(base + 864e5).toISOString()).limit(2000);
    if (res.error) throw res.error; return res.data ?? [];
  } });
  const overlaps = useMemo(() => {
    const m = new Map<string, { id: string; name: string; sites: { name: string; range: string }[] }>();
    for (const r of rows) { const mine = countable(r); if (!mine.length) continue;
      const others = (otherSites.data ?? []).filter(o => o.personnel_id === r.id && o.in_at).map(o => ({ ...o, in_at: o.in_at as string }));
      const hits = overlappingStays(mine, others); if (!hits.length) continue;
      const sites = new Map<string, string>();
      for (const h of hits) { const n = h.location_name || 'another site'; const range = `${localTime(h.in_at, tz).replace(':', '')}–${h.out_at ? localTime(h.out_at, tz).replace(':', '') : 'open'}`; sites.set(n, sites.has(n) ? `${sites.get(n)}, ${range}` : range); }
      m.set(r.id, { id: r.id, name: r.name, sites: [...sites].map(([name, range]) => ({ name, range })) });
    }
    return m;
  }, [rows, otherSites.data, tz]);
  const staffRows = useMemo(() => rows.map(r => ({ ...r, role: resolveRole(r.role, (roleHistory.data ?? []).filter(h => h.personnel_id === r.id)), stays: countable(r) })), [rows, roleHistory.data]);
  const ignoredShort = rows.filter(r => r.stays.length && !countable(r).length).map(r => r.name);
  const today = localDay(new Date().toISOString(), tz);
  const openedPeople=useQuery({queryKey:['punch-open-names',locationId,day,(linkEvents.data||[]).map(e=>e.personnel_id).join(',')],enabled:canWrite&&!!linkEvents.data?.length,queryFn:async()=>{const ids=[...new Set((linkEvents.data||[]).map(e=>e.personnel_id))];const result=await supabase.from('personnel_directory').select('id,first_name,last_name').in('id',ids);if(result.error)throw result.error;return result.data;}});
  const stale = (q.data?.openStays ?? []).filter(s => localDay(s.in_at, tz) < today);
  const present = rows.filter(r => r.stays.length).length;
  const total = rows.reduce((s, r) => s + r.stays.reduce((h, x) => h + (x.out_at ? Number(x.hours) || 0 : 0), 0), 0);
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
      for (const p of create) { try { await logTime.mutateAsync({ personnel_id: p.id, location_id: locationId, day: bulk.date, in_at: inAt ?? '', out_at: outAt ?? '', note: note ?? 'Bulk time entry' }); made++; } catch { failed.push(p.name); } }
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

  type AttendanceRow = typeof rows[number];
  const columns: EnhancedColumn<AttendanceRow>[] = [
    { key: 'name', header: 'Person', width: 250, render: r => <span>{r.name || 'Unnamed'} {r.demobilized && <Badge variant="outline">Demobilized</Badge>}</span> },
    { key: 'role', header: 'Position' },
    { key: 'in', header: 'In', getValue: r => r.stays[0] ? hm(r.stays[0].in_at, tz) : '—', render: r => { const st=r.stays[0]; return <span title={punchTimeDetail(st?.actual_in_at,st?.in_at,tz)}>{st ? hm(st.in_at,tz) : '—'}</span>; } },
    { key: 'out', header: 'Out', getValue: r => { const last = r.stays.at(-1); return last ? last.out_at ? hm(last.out_at, tz) : 'open' : '—'; }, render: r => { const st=r.stays.at(-1); return <span title={punchTimeDetail(st?.actual_out_at,st?.out_at,tz)}>{st ? st.out_at ? hm(st.out_at,tz) : 'open' : '—'}</span>; } },
    { key: 'status', header: 'Status', width: 300,
      getValue: r => [r.demobilized ? 'Demobilized' : '', r.offRoster ? 'Not on roster this day' : '', !r.stays.length ? 'Not signed in' : r.stays.some(st => (st.late_minutes ?? 0) > 0) ? 'Late' : 'On time', r.stays.some(st => st.in_geofence === false || st.offsite_reason) ? 'Off-site' : ''].filter(Boolean).join(' · '),
      render: r => { const late = r.stays.find(st => (st.late_minutes ?? 0) > 0); return <span className="flex flex-wrap items-center gap-1">
        {!r.stays.length && <Badge variant="outline">Not signed in</Badge>}
        {r.stays.some(st=>st.demobe)&&<Badge variant="outline">Demobe</Badge>}
        {r.stays.some(st=>st.auto_closed_at)&&<Badge variant="outline" className="text-warning">Forgot to clock out · auto-closed</Badge>}
        {r.offRoster && <Badge variant="outline">Not on roster this day</Badge>}
        {late ? <Badge variant="outline" className={late.late_ack_reason ? 'text-warning' : 'text-destructive'} title={[late.late_reason, late.late_ack_reason].filter(Boolean).join(' · ')}>LATE {late.late_minutes}m{late.late_ack_reason ? ' · approved' : ''}</Badge> : r.stays.length > 0 && <Badge variant="outline" className="text-success">On time</Badge>}
        {late && canWrite && <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAck({ stay: late, preset: '', text: '' })}><CheckCircle2 className="h-3 w-3 mr-1" />{late.late_ack_reason ? 'Change approval' : 'Approve late'}</Button>}
        {r.stays.some(st => st.in_geofence === false || st.offsite_reason) && <Badge variant="outline" className="text-warning" title={r.stays.find(st => st.offsite_reason)?.offsite_reason || undefined}>Off-site</Badge>}
        {r.stays.some(st => st.in_geofence) && <Badge variant="outline">In geofence</Badge>}
        {r.stays.some(st => st.synced_late) && <Badge variant="outline">synced late</Badge>}
      </span>; } },
    { key: 'hours', header: 'Hours', getValue: r => r.stays.reduce((n, st) => n + (st.out_at ? Number(st.hours) || 0 : 0), 0) },
    { key: 'stays', header: 'Stays', width: 270, getValue: r => r.stays.length,
      noExport:mobile,
      render: r => <div className="space-y-1">{r.stays.map((st, i) => <div key={st.id}><div className="flex items-center gap-1"><span>Stay {i + 1}</span>{canWrite && <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={r.stays.length === 1 ? `Edit times for ${r.name}` : `Edit stay ${i + 1} for ${r.name}`} onClick={() => setEdit({ ids: [st.id], name: r.name, day })}><Pencil className="h-3 w-3" /></Button>}</div>{(punchTimeDetail(st.actual_in_at,st.in_at,tz)||punchTimeDetail(st.actual_out_at,st.out_at,tz))&&<details className="text-xs text-muted-foreground"><summary>Tap record</summary><p className="whitespace-normal">{punchTimeDetail(st.actual_in_at,st.in_at,tz)}</p><p className="whitespace-normal">{punchTimeDetail(st.actual_out_at,st.out_at,tz)}</p></details>}</div>)}</div> },
    ...(canWrite ? [{ key: 'actions', header: 'Actions', noExport: true, sortable: false, filterable: false, render: (r: AttendanceRow) => <Button size="sm" variant="ghost" aria-label={r.stays.length ? `Add entry for ${r.name}` : `Set arrival for ${r.name}`} onClick={() => setLog({ id: r.id, name: r.name })}><Plus className="h-3.5 w-3.5 mr-1" />{r.stays.length ? 'Add entry' : 'Arrival'}</Button> }] : []),
  ];

  const dialogs = <>
    {edit && <EditStayTimesDialog projectId={projectId} ids={edit.ids} personName={edit.name} day={edit.day} onClose={() => { setEdit(null); void q.refetch(); }} />}
    {log && <LogTimeDialog open onOpenChange={o => { if (!o) { setLog(null); void q.refetch(); } }} projectId={projectId} personnelId={log.id} personName={log.name} locationId={locationId} defaultDate={day} />}
    {addCrew && crew && <CrewAddToDayDialog projectId={projectId} locationId={locationId} timezone={tz} day={day} assignments={roster.filter(a => a.assignedOnDay)} excludeIds={new Set(rows.filter(r => r.stays.length).map(r => r.id))} onChooseProjectPerson={() => { setAddCrew(false); setAddPerson(true); }} onClose={n => { setAddCrew(false); void q.refetch(); if (n) toast.success(`Added ${n} ${n === 1 ? 'person' : 'people'} to ${day}`); }} />}
    {addPerson && <LogTimeDialog open addToDay onOpenChange={o => { if (!o) { setAddPerson(false); void q.refetch(); } }} projectId={projectId} locationId={locationId} defaultDate={day} />}

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
  </>;
  const mobe = useMobeRows(locationId, day, !!crew);
  const setStatus = useSetStatus();
  const resolutions = useDayResolutions(locationId, day);
  const { data: projectRow } = useProject(crew ? projectId : '');
  const { data: projLocations } = useProjectLocations(crew ? projectId : '');
  const endAssignment = useEndAssignment();
  const pad = (iso: string | null | undefined) => iso ? hm(iso, tz) : '';
  const saveIn = async (r: AttendanceRow, v: string) => {
    const st = r.stays[0];
    const inAt = locationTimeIso(day, v, tz);
    if (st) { if (st.out_at && Date.parse(st.out_at) <= Date.parse(inAt)) throw new Error('Time in must be before time out'); await editTimes.mutateAsync([{ id: st.id, inAt, outAt: st.out_at, remove: false, note: 'Crew grid inline edit' }]); }
    else { setDrafts(d => ({ ...d, [r.id]: v })); toast.info(`Now enter ${r.name}'s time out to add them to this day`); return; }
    void q.refetch();
  };
  const saveOut = async (r: AttendanceRow, v: string) => {
    const st = r.stays.at(-1);
    const baseIn = st?.in_at ?? (drafts[r.id] ? locationTimeIso(day, drafts[r.id], tz) : null);
    if (!baseIn) throw new Error('Enter time in first');
    let outAt = locationTimeIso(day, v, tz);
    if (Date.parse(outAt) <= Date.parse(baseIn)) outAt = locationTimeIso(nextDay(day), v, tz);
    if (st) await editTimes.mutateAsync([{ id: st.id, inAt: st.in_at, outAt, remove: false, note: 'Crew grid inline edit' }]);
    else { await logTime.mutateAsync({ personnel_id: r.id, location_id: locationId, day, in_at: baseIn, out_at: outAt, note: 'Crew grid inline entry' }); setDrafts(d => { const n = { ...d }; delete n[r.id]; return n; }); }
    toast.success('Saved'); void q.refetch();
  };
  const demob = async (r: AttendanceRow) => {
    const a = crew?.assignments.find(x => x.personnel_id === r.id);
    if (!a || !window.confirm(`Demobilize ${r.name} with ${day} as their last day here? Worked days stay editable.`)) return;
    await setStatus.mutateAsync({ personnelIds: [r.id], status: 'demobilized', project_id: projectId, note: `Demobilized from crew grid · last day ${day}` });
    await endAssignment.mutateAsync({ id: a.id, location_id: locationId, endAt: new Date(midnight(nextDay(day), tz)).toISOString() });
  };
  const markWorked = async (ids: string[]) => {
    const plan = scheduledShift(day, 'day', projLocations?.find(l => l.id === locationId) as any, projectRow as any);
    const range = manualTimeRange(day, plan.timeIn, plan.timeOut, tz, plan.outDay);
    if (!range) throw new Error('Set this location\'s day shift times first');
    const added: { id: string; name: string }[] = [];
    for (const id of ids) {
      const r = rows.find(x => x.id === id);
      await logTime.mutateAsync({ personnel_id: id, location_id: locationId, day, in_at: range.inAt, out_at: range.outAt, note: 'Need action: worked (shift default)' });
      added.push({ id, name: r?.name || 'person' });
    }
    void q.refetch();
    const span = `${plan.timeIn.replace(':', '')}–${plan.timeOut.replace(':', '')}`;
    const who = added.length === 1 ? added[0].name : `${added.length} people`;
    // Reuse the existing signature-request sender (same as Missing signatures).
    const failed: string[] = [];
    try {
      const { data, error } = await supabase.functions.invoke('timesheet-signature', { body: { action: 'request', location_id: locationId, sheet_date: day, personnel_ids: added.map(a => a.id) } });
      if (error) throw error;
      const res: { personnel_id: string; status: string }[] = data?.results ?? [];
      for (const a of added) {
        let st = res.find(x => x.personnel_id === a.id)?.status;
        if (st === 'already_requested') {
          const rs = await supabase.functions.invoke('timesheet-signature', { body: { action: 'resend', location_id: locationId, personnel_id: a.id } });
          st = rs.error ? 'failed' : rs.data?.results?.[0]?.status;
        }
        if (st !== 'requested' && st !== 'resent') failed.push(a.name);
      }
    } catch { failed.push(...added.map(a => a.name).filter(n => !failed.includes(n))); }
    if (failed.length < added.length) toast.success(`Added ${who} ${span}. Signature link sent.`);
    else toast.success(`Added ${who} ${span}.`);
    if (failed.length) toast.warning(`No signature text sent to: ${failed.join(', ')} (no phone, consent, or send failed).`);
  };
  const presenceFor = (id: string) => !!q.data?.presence?.some(x => x.personnelId === id);
  const sigFor = (id: string) => { const rs = (q.data?.sigRows ?? []).filter(x => x.personnelId === id); return rs.length ? rs.some(x => x.signature) : null; };
  const crewColumns: EnhancedColumn<AttendanceRow>[] = crew ? [
    { key: 'name', header: 'Name', width: 220, getValue: r => r.name, render: r => { const o = overlaps.get(r.id); return <span className="flex min-w-0 items-center gap-1"><span className="truncate" title={r.name}>{r.name || 'Unnamed'}</span>{o && <Badge variant="outline" className="shrink-0 text-warning" title={o.sites.map(x => `${x.name} ${x.range}`).join('; ')}>⚠ Also at {o.sites.map(x => x.name).join(', ')}</Badge>}</span>; } },
    { key: 'role', header: 'Role', width: 170, getValue: r => r.role ?? '' },
    { key: 'employer', header: 'Employer', width: 170, getValue: r => crew.agencies.employerName(r.id) || crew.agencies.agencyName(r.id) || 'FRG', render: r => { const n = crew.agencies.employerName(r.id) || crew.agencies.agencyName(r.id) || 'FRG'; const nb = crew.agencies.nonBillableByPerson[r.id]; return <span className="inline-flex max-w-full items-center gap-1.5"><Badge variant="outline" className="max-w-[10rem] truncate font-normal" title={n}>{n.replace(/ \(customer\)$/, '')}</Badge>{nb && <span className="h-2 w-2 shrink-0 rounded-full bg-warning" title="Non-billable" aria-label="Non-billable" />}</span>; } },
    { key: 'in', header: 'In', width: 90, getValue: r => pad(r.stays[0]?.in_at), render: r => <span title={punchTimeDetail(r.stays[0]?.actual_in_at, r.stays[0]?.in_at, tz)}><TimeCell label={`Time in for ${r.name}`} disabled={!canWrite} value={pad(r.stays[0]?.in_at) || drafts[r.id] || ''} onCommit={v => saveIn(r, v)} /></span> },
    { key: 'out', header: 'Out', width: 90, getValue: r => pad(r.stays.at(-1)?.out_at), render: r => <span title={punchTimeDetail(r.stays.at(-1)?.actual_out_at, r.stays.at(-1)?.out_at, tz)}><TimeCell label={`Time out for ${r.name}`} disabled={!canWrite} value={pad(r.stays.at(-1)?.out_at)} onCommit={v => saveOut(r, v)} /></span> },
    { key: 'hours', header: 'Hours', width: 70, getValue: r => r.stays.reduce((n, st) => n + (st.out_at ? Number(st.hours) || 0 : 0), 0), render: r => { const h = r.stays.reduce((n, st) => n + (st.out_at ? Number(st.hours) || 0 : 0), 0); return r.stays.length ? h.toFixed(2) : ''; } },
    { key: 'sig', header: 'Signature', width: 90, getValue: r => { const s = sigFor(r.id); return s ? 'Signed' : presenceFor(r.id) ? 'Presence only' : s == null ? '' : 'Missing'; }, render: r => { const s = sigFor(r.id); if (!s && presenceFor(r.id)) return <Badge variant="outline" className="text-info font-normal" title="Signed — presence only, no times">Presence only</Badge>; return s == null ? null : s ? <CheckCircle2 className="h-4 w-4 text-success" aria-label="Signed" /> : <span className="text-destructive text-xs font-medium">missing</span>; } },
    { key: 'tag', header: 'Day', width: 130, getValue: r => [mobe.data?.find(m => m.personnelId === r.id) ? (mobe.data.find(m => m.personnelId === r.id)?.kind === 'demobe' ? 'DEMOBE' : 'MOBE') : '', r.stays.some(st => st.demobe) ? 'DEMOBE' : '', r.stays.some(st => (st.late_minutes ?? 0) > 0) ? 'Late' : '', r.stays.some(st => st.auto_closed_at) ? 'Auto-closed' : ''].filter(Boolean).join(' · '),
      render: r => { const m = mobe.data?.find(x => x.personnelId === r.id); const late = r.stays.find(st => (st.late_minutes ?? 0) > 0); return <span className="flex flex-wrap gap-1">
        {m && <Badge variant="outline" className="text-info">{m.kind === 'demobe' ? 'DEMOBE' : 'MOBE'}</Badge>}
        {r.stays.some(st => st.demobe) && <Badge variant="outline">DEMOBE</Badge>}
        {late && <button type="button" disabled={!canWrite} onClick={() => setAck({ stay: late, preset: '', text: '' })}><Badge variant="outline" className={late.late_ack_reason ? 'text-warning' : 'text-destructive'} title={[late.late_reason, late.late_ack_reason].filter(Boolean).join(' · ') || 'Approve late'}>Late {late.late_minutes}m</Badge></button>}
        {r.stays.some(st => st.auto_closed_at) && <Badge variant="outline" className="text-warning" title="Forgot to clock out · auto-closed">Auto-closed</Badge>}
      </span>; } },
    { key: 'actions', header: 'Actions', width: 105, noExport: true, sortable: false, filterable: false, render: r => <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="min-h-11 px-2" aria-label={`Actions for ${r.name}`}><MoreHorizontal className="h-4 w-4 mr-1" />Actions</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => crew.onText([r.id])}><MessageSquare className="h-4 w-4 mr-2" />Text punch link</DropdownMenuItem>
      {canWrite && r.stays.length > 0 && <DropdownMenuItem onClick={() => setEdit({ ids: r.stays.map(st => st.id), name: r.name, day })}>Edit times…</DropdownMenuItem>}
      {canWrite && <DropdownMenuItem onClick={() => setLog({ id: r.id, name: r.name })}>{r.stays.length ? 'Add another stay…' : 'Set arrival…'}</DropdownMenuItem>}
      {canWrite && !r.demobilized && crew.assignments.some(x => x.personnel_id === r.id) && <DropdownMenuItem onClick={() => void demob(r).catch(e => toast.error(e instanceof Error ? e.message : 'Demobilize failed'))}>Demobilize (last day {day.slice(5).replace('-', '/')})…</DropdownMenuItem>}
      <DropdownMenuSeparator /><DropdownMenuItem asChild><Link to={`/personnel/${r.id}`}>Open profile</Link></DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu> },
  ] : [];
  const shiftDay = (n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); setDay(d.toISOString().slice(0, 10)); setSel(new Set()); };
  if (crew) {
    const timedIds = presentIds;
    const presenceCount = presenceOnlyCount(timedIds, (q.data?.presence ?? []).map(x => x.personnelId));
    const rosterToday = rows.filter(r => !r.demobilized && crew.assignments.some(a => a.personnel_id === r.id));
    const resolved = resolutions.data ?? [];
    const needIds = new Set(needActionIds(rosterToday.map(r => r.id), timedIds, resolved.map(x => x.personnel_id)));
    const needPeople = rosterToday.filter(r => needIds.has(r.id));
    const dLabel = `${new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${day.slice(5, 7)}/${day.slice(8, 10)}`;
    const summaryText = crewDaySummary(day, rows.map(r => ({ present: r.stays.length > 0, role: r.role, onRoster: !r.demobilized && crew.assignments.some(a => a.personnel_id === r.id) })), headcountLine(timedIds.length, presenceCount, expectedTotal(expected.data)));
    const selectedPeople = rows.filter(r => sel.has(r.id)).map(r => { const [first, ...rest] = r.name.split(' '); return { id: r.id, first_name: first ?? '', last_name: rest.join(' '), phone: crew.phones[r.id] ?? null }; });
    return <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="min-h-11 px-2" aria-label="Previous day" onClick={() => shiftDay(-1)}><ChevronLeft className="h-4 w-4 mr-1" />Prev</Button>
          <Input aria-label="Day" type="date" className="h-11 w-36 min-w-0" value={day} onChange={e => { if (e.target.value) { setDay(e.target.value); setSel(new Set()); } }} />
          <Button variant="outline" size="sm" className="min-h-11 px-2" aria-label="Next day" onClick={() => shiftDay(1)}><span className="mr-1">Next</span><ChevronRight className="h-4 w-4" /></Button>
          {day !== today && <Button variant="ghost" size="sm" className="h-8" onClick={() => { setDay(today); setSel(new Set()); }}>Today</Button>}
        </div>
        <p className="text-sm font-medium" aria-label="Crew summary">{dLabel} · {timedIds.length} on sheet{needIds.size > 0 && <> · <span className="text-warning">{needIds.size} need action</span></>}</p>
        {needIds.size === 0 && !resolutions.isLoading && <Badge variant="outline" className="text-success border-success/40">All accounted for</Badge>}
        <MissingSignatures compact locationId={locationId} day={day} zone={tz} rows={q.data?.sigRows ?? []} />
        <div className="ml-auto flex flex-wrap items-center gap-1">{crew.header}{canWrite && <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="min-h-11"><Plus className="h-4 w-4 mr-1" />Add</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-11" onSelect={crew.onAssign}>Assign to roster</DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={() => setAddCrew(true)}>Add to this day (with times)</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>}</div>
      </div>
      <details className="group text-xs text-muted-foreground"><summary className="cursor-pointer w-fit min-h-11 flex items-center gap-1"><ChevronRight className="h-3.5 w-3.5 group-open:rotate-90"/>Day details</summary><div className="mt-1 flex flex-wrap items-center gap-2"><span>{summaryText}</span>{(mobe.data?.length ?? 0) > 0 && <span>+{mobe.data?.length} MOBE</span>}</div></details>
      <NeedActionList locationId={locationId} day={day} tz={tz} people={needPeople} resolutions={resolved} linkEvents={linkEvents.data ?? []} canWrite={canWrite} names={Object.fromEntries(rows.map(r => [r.id, r.name]))} onWorked={markWorked} onDemob={id => { const r = rows.find(x => x.id === id); return r ? demob(r).then(() => resolutions.refetch()).then(() => undefined) : Promise.resolve(); }} />
      {(q.data?.presence?.length ?? 0) > 0 && <p className="text-xs text-muted-foreground">Signed — presence only, no times ({q.data!.presence.length}): {q.data!.presence.map(x => x.name).join(', ')}</p>}
      {stale.length > 0 && <p className="text-sm text-warning"><AlertTriangle className="inline h-4 w-4 mr-1" />{stale.length} open punch{stale.length === 1 ? '' : 'es'} from earlier days: {stale.map(s => <Button key={s.id} variant="link" size="sm" className="h-auto p-0 px-1" disabled={!canWrite} onClick={() => setEdit({ ids: [s.id], name: s.name })}>{s.name} ({dayLabel(s.in_at, tz)})</Button>)}</p>}
      <DayStaffingBreakdown locationId={locationId} day={day} zone={tz} rows={staffRows} expected={expected.data ?? carry.data ?? null} expectedDay={expected.data ? day : carry.data?.day ?? null} ignoredShort={ignoredShort} overlaps={[...overlaps.values()]} requiredEditor={source => canWrite && <ExpectedHeadcountEdit label={source === 'site' ? 'Customer headcount' : source === 'customer' ? 'Edit required' : 'Set required'} canSave={isAdmin} locationId={locationId} day={day} value={expected.data ?? null} onSaved={() => expected.refetch()} />} siteEditor={canWrite && <Button variant="ghost" size="sm" className="min-h-11 px-1 text-xs" onClick={crew.onRequirements}>Site requirements</Button>} mobeCount={mobe.data?.filter(m=>m.kind!=='demobe').length ?? 0} demobeCount={(mobe.data?.filter(m=>m.kind==='demobe').length ?? 0) + rows.filter(r=>r.stays.some((st:any)=>st.demobe)).length} />
      {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : q.error ? <p role="alert" className="text-sm text-destructive">Attendance could not be loaded.</p> :
        <EnhancedDataTable tableId={`crew:${locationId}`} data={rows} columns={crewColumns} selectable={canWrite} selectedIds={sel} onSelectionChange={setSel} exportName={`crew-${day}`} searchPlaceholder="Search crew…"
          attention={r => r.stays.some(st => !st.out_at) && localDay(r.stays[0].in_at, tz) < today ? 'Open punch' : null}
          emptyText="No one on the roster or signed in on this day."
          bulkActions={(_, clear) => <><Button size="sm" variant="outline" onClick={() => setBulk({ date: day, inTime: '', outTime: '', note: '' })}><Clock className="h-3.5 w-3.5 mr-1" />Set times</Button><Button size="sm" variant="outline" onClick={() => crew.onText([...sel])}><MessageSquare className="h-3.5 w-3.5 mr-1" />Text this site</Button><PersonnelBulkActions people={selectedPeople} worksFor={p => crew.agencies.employerName(p.id) || crew.agencies.agencyName(p.id) || 'FRG'} onDone={clear} locationId={locationId} /></>} />}
      {dialogs}
    </div>;
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <div><label htmlFor="att-day" className="text-sm block">Date</label><div className="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label="Previous day" title="Previous day" onClick={() => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); setDay(d.toISOString().slice(0,10)); setSel(new Set()); }}><ChevronLeft className="h-4 w-4" /></Button>
        <Input id="att-day" type="date" className="w-44" value={day} onChange={e => { if (e.target.value) { setDay(e.target.value); setSel(new Set()); } }} />
        <Button variant="outline" size="icon" aria-label="Next day" title="Next day" onClick={() => { setDay(nextDay(day)); setSel(new Set()); }}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => { setDay(today); setSel(new Set()); }}>Today</Button>
      </div></div>
      <div className="flex flex-wrap items-center gap-2 pb-2"><p className="text-sm text-muted-foreground">{present}/{rows.length} signed in · {total.toFixed(2)} h closed</p><MissingSignatures compact locationId={locationId} day={day} zone={tz} rows={q.data?.sigRows ?? []} /></div>
      <div className="w-full pb-2"><MobeSection locationId={locationId} day={day} onsite={present} /></div>
      {canWrite && <Button className="ml-auto" size="sm" variant="outline" disabled={!sel.size} onClick={() => setBulk({ date: day, inTime: '', outTime: '', note: '' })}><Clock className="h-4 w-4 mr-1" />Set times for {sel.size || ''} selected</Button>}
      {canWrite && <Button size="sm" onClick={() => setAddPerson(true)}><Plus className="h-4 w-4 mr-1" />Add person to this day</Button>}
    </div>
    {stale.length > 0 && <div className="rounded-md border border-warning/50 bg-warning/5 p-3 space-y-2" role="region" aria-label="Open punches">
      <p className="text-sm font-medium"><AlertTriangle className="inline h-4 w-4 mr-1 text-warning" />{stale.length} open punch{stale.length === 1 ? '' : 'es'} from earlier days — not counted in hours until closed</p>
      <ul className="divide-y">{stale.map(s => <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 text-sm"><span>{s.name} · in {dayLabel(s.in_at, tz)} {hm(s.in_at, tz)}</span>{canWrite && <Button size="sm" variant="outline" onClick={() => setEdit({ ids: [s.id], name: s.name })}>Close / fix</Button>}</li>)}</ul>
    </div>}
    {canWrite&&<details className="border-b pb-3"><summary className="cursor-pointer text-sm font-medium">Link opened · {linkEvents.data?.length??0}</summary>{linkEvents.error?<p role="alert">Link-open records could not be loaded.</p>:<ul className="divide-y">{linkEvents.data?.map(e=>{const p=openedPeople.data?.find(p=>p.id===e.personnel_id);return <li key={e.id} className="py-2 text-sm">{p?[p.first_name,p.last_name].filter(Boolean).join(' '):'Worker'} · {hm(e.opened_at,tz).replace(':','')} · {e.gps_status==='captured'?`${e.lat?.toFixed(6)}, ${e.lng?.toFixed(6)}`:'GPS unavailable'}{!rows.find(r=>r.id===e.personnel_id)?.stays.length&&' · No punch recorded'}</li>;})}</ul>}</details>}
    {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : q.error ? <p role="alert" className="text-sm text-destructive">Attendance could not be loaded.</p> :
      <EnhancedDataTable tableId={`attendance:${locationId}`} data={rows} columns={columns}
        selectable={canWrite} selectedIds={sel} onSelectionChange={setSel} exportName={`attendance-${day}`}
        attention={r => r.stays.some(st => !st.out_at) ? 'Open punch' : r.stays.some(st => (st.late_minutes ?? 0) > 0 && !st.late_ack_reason) ? 'Late approval needed' : null}
        emptyText="No one assigned or signed in on this day."
        bulkActions={() => <Button size="sm" variant="outline" onClick={() => setBulk({ date: day, inTime: '', outTime: '', note: '' })}><Clock className="h-3.5 w-3.5 mr-1" />Set times</Button>}
      />}
    {dialogs}
  </div>;
}
