import { EnhancedDataTable, type EnhancedColumn } from '@/components/shared/EnhancedDataTable';
import { useSessionState } from '@/hooks/useSessionState';
import { assetCareLabel, ownershipText } from '@/lib/assetDetails';
import type { AssetAssignmentWithDetails } from '@/integrations/supabase/hooks/useAssetAssignments';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Time24Input } from '@/components/ui/time24-input';
import { ChevronDown, Loader2, MessageSquare, MoreHorizontal, Truck } from 'lucide-react';
import { EntityContextMenu } from '@/components/shared/EntityContextMenu';
import { AgencyChip } from '@/components/personnel/AgencyChip';
import { NonBillableChip } from '@/components/personnel/NonBillableChip';
import { TextedCaption } from './SendSiteTextDialog';
import { RoleSelect } from './RoleSelect';
import { useOnSiteMap, useSetStatus } from '@/integrations/supabase/hooks/usePersonnelStatus';
import { type LocationAssignment, useChangeAssignmentRole, useSetMission, useEndAssignment } from '@/integrations/supabase/hooks/useLocationStaffing';
import { localDay, localTime, midnight, nextDay } from '@/lib/signinSheets';
import { locationTimeIso } from '@/lib/manualTime';
import { isHHmm, todayStatus, type TodayStatus } from '@/lib/assignmentRoles';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { PersonnelBulkActions } from '@/components/personnel/PersonnelBulkActions';

type Agencies = { agencyName: (id: string) => string | null | undefined; employerName: (id: string) => string | null | undefined; nonBillableByPerson: Record<string, boolean | undefined> };

function StatusPill({ s, tz, elsewhere }: { s: TodayStatus; tz: string; elsewhere?: string | null }) {
  if (elsewhere && (s.kind === 'not_checked_in' || s.kind === 'checked_out')) return <Badge variant="outline" className="bg-muted text-muted-foreground max-w-[16rem] truncate" title={`At other site: ${elsewhere}`}>At other site: {elsewhere}</Badge>;
  switch (s.kind) {
    case 'checked_in': return <Badge variant="outline" className="border-success bg-success/15 text-success whitespace-nowrap">Checked in {localTime(s.at, tz)}</Badge>;
    case 'checked_out': return <Badge variant="outline" className="text-muted-foreground whitespace-nowrap">Checked out {localTime(s.at, tz)}</Badge>;
    case 'mission': return <Badge variant="outline" className="border-info/50 bg-info/10 text-info max-w-[14rem] truncate" title={s.note || undefined}>Off-site mission{s.note ? ` · ${s.note}` : ''}</Badge>;
    case 'demobilized': return <Badge variant="outline" className="bg-secondary text-secondary-foreground">Demobilized</Badge>;
    default: return <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground whitespace-nowrap">Not checked in</Badge>;
  }
}

const COLS = 'sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1fr)_5.5rem]';

export function LocationRoster({ locationId, projectId, timezone, canWrite, assignments, reqRoles, byRole, agencies, phones, texted, onText, onLog, onExpense, onUnassign }: {
  locationId: string; projectId?: string; timezone?: string | null; canWrite: boolean; assignments: LocationAssignment[]; reqRoles: string[]; byRole: Record<string, { needed: number; assigned: number; rate: number | null }>;
  agencies: Agencies; phones: Record<string, string | null>; texted: Record<string, string>;
  onText: (ids: string[]) => void; onLog: (id: string) => void; onExpense: (id: string) => void; onUnassign: (a: LocationAssignment) => void;
}) {
  const tz = timezone || 'America/Chicago';
  const today = localDay(new Date().toISOString(), tz);
  const { data: onSite = {} } = useOnSiteMap();
  const setStatus = useSetStatus();
  const changeRole = useChangeAssignmentRole();
  const setMission = useSetMission();
  const [roleDlg, setRoleDlg] = useState<{ a: LocationAssignment; role: string | null; date: string; time: string } | null>(null);
  const [missionDlg, setMissionDlg] = useState<{ a: LocationAssignment; note: string } | null>(null);
  const [demobOpen, setDemobOpen] = useState(false);
  const endAssignment = useEndAssignment();
  const [q, setQ] = useSessionState(`roster:${locationId}:search`, '');
  const [selected, setSelected] = useSessionState<string[]>(`roster:${locationId}:selection`, []);
  const sel = new Set(selected);
  const setSel = (ids: Set<string>) => setSelected([...ids]);
  const toggle = (id: string) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const [endDlg, setEndDlg] = useState<{ a: LocationAssignment; date: string; demob: boolean } | null>(null);
  const runEnd = async () => {
    if (!endDlg || !/^\d{4}-\d{2}-\d{2}$/.test(endDlg.date)) return;
    const endAt = new Date(midnight(nextDay(endDlg.date), tz)).toISOString();
    if (endDlg.demob && projectId) await setStatus.mutateAsync({ personnelIds: [endDlg.a.personnel_id], status: 'demobilized', project_id: projectId, note: `Demobilized from location roster · last day ${endDlg.date}` });
    await endAssignment.mutateAsync({ id: endDlg.a.id, location_id: locationId, endAt });
    setEndDlg(null);
  };

  // Attendance for THIS location only (never other sites).
  const stays = useQuery({
    queryKey: ['visits-window', 'roster-today', locationId, today], refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel_location_trail').select('personnel_id,in_at,out_at').eq('location_id', locationId).gte('in_at', new Date(Date.now() - 36 * 3600e3).toISOString());
      if (error) throw error;
      const m: Record<string, { in_at: string; out_at: string | null }[]> = {};
      for (const r of data ?? []) if (r.personnel_id && r.in_at && (localDay(r.in_at, tz) === today || !r.out_at)) (m[r.personnel_id] ??= []).push({ in_at: r.in_at, out_at: r.out_at });
      return m;
    },
  });
  const otherIds = [...new Set(Object.values(onSite).filter(o => o.location_id !== locationId).map(o => o.project_id))];
  const otherProjects = useQuery({
    queryKey: ['roster-other-projects', otherIds.sort()], enabled: otherIds.length > 0, staleTime: 60000,
    queryFn: async () => { const { data, error } = await supabase.from('projects').select('id,name').in('id', otherIds); if (error) throw error; return Object.fromEntries((data ?? []).map(p => [p.id, p.name])); },
  });
  const assets = useQuery({
    queryKey: ['location-roster-assets', locationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('asset_placements', { p_location_id: locationId });
      if (error) throw error;
      return ((data ?? []) as unknown as AssetAssignmentWithDetails[]).filter(a => a.status === 'active' && !a.unassigned_at && !a.end_at);
    },
  });

  const { groups, demob } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (a: LocationAssignment) => !needle || `${a.personnel?.first_name ?? ''} ${a.personnel?.last_name ?? ''} ${a.role_label ?? ''}`.toLowerCase().includes(needle);
    const active = assignments.filter(a => !a.demobilized && match(a));
    const by = new Map<string, LocationAssignment[]>();
    for (const a of active) { const k = a.role_label || 'No role'; by.set(k, [...(by.get(k) ?? []), a]); }
    const rank = (k: string) => /supervisor|lead|foreman/i.test(k) ? 0 : /operator/i.test(k) ? 1 : k === 'No role' ? 9 : 2;
    const name = (a: LocationAssignment) => [a.personnel?.first_name, a.personnel?.last_name].filter(Boolean).join(' ');
    for (const [k, v] of Object.entries(byRole)) if (!needle && v.needed > 0 && !by.has(k)) by.set(k, []);
    const inNow = (a: LocationAssignment) => (stays.data?.[a.personnel_id] ?? []).some(x => !x.out_at) ? 0 : 1;
    return {
      groups: [...by.entries()].sort((x, y) => rank(x[0]) - rank(y[0]) || x[0].localeCompare(y[0])).map(([k, v]) => [k, v.sort((p, q) => inNow(p) - inNow(q) || name(p).localeCompare(name(q)))] as const),
      demob: assignments.filter(a => a.demobilized && match(a)),
    };
  }, [assignments, byRole, stays.data, q]);

  const personName = (a: LocationAssignment) => [a.personnel?.first_name, a.personnel?.last_name].filter(Boolean).join(' ') || 'Unknown';
  const statusFor = (a: LocationAssignment) => todayStatus({ demobilized: !!a.demobilized, stays: stays.data?.[a.personnel_id] ?? [], missionToday: a.mission_day === today, missionNote: a.mission_note ?? null });
  type GridRow = LocationAssignment & { assignment: LocationAssignment };
  const columns: EnhancedColumn<GridRow>[] = [
    { key: 'name', header: 'Name', width: 240, getValue: a => personName(a), render: a => <Link to={`/personnel/${a.personnel_id}`} className="hover:text-primary hover:underline">{personName(a)}</Link> },
    { key: 'role_label', header: 'Position' },
    { key: 'employer', header: 'Agency / employer', getValue: a => agencies.employerName(a.personnel_id) || agencies.agencyName(a.personnel_id) || 'FRG', render: a => <><AgencyChip name={agencies.agencyName(a.personnel_id)} /><NonBillableChip value={agencies.nonBillableByPerson[a.personnel_id]} employer={agencies.employerName(a.personnel_id)} /></> },
    { key: 'phone', header: 'Phone', getValue: a => phones[a.personnel_id] ?? '' },
    { key: 'status', header: 'Today here', getValue: a => statusFor(a).kind, render: a => { const os = onSite[a.personnel_id]; const elsewhere = os && os.location_id !== locationId ? `${os.location_name ?? 'site'}${os.project_id !== projectId ? ` (${otherProjects.data?.[os.project_id] ?? 'other project'})` : ''}` : null; return <StatusPill s={statusFor(a)} tz={tz} elsewhere={elsewhere} />; } },
    { key: 'texted', header: 'Last texted', getValue: a => texted[`${a.personnel_id}:${locationId}`] ?? '', render: a => <TextedCaption at={texted[`${a.personnel_id}:${locationId}`]} /> },
    { key: 'actions', header: 'Actions', noExport: true, sortable: false, filterable: false, render: item => { const a = item.assignment; const name = personName(a); return (
        <div className="flex items-center justify-end gap-0.5 order-5 sm:order-none">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Send site text to ${name}`} onClick={() => onText([a.personnel_id])}><MessageSquare className="h-4 w-4" /></Button>
          {canWrite && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRoleDlg({ a, role: a.role_label, date: today, time: localTime(new Date().toISOString(), tz) })}>Change position…</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLog(a.personnel_id)}>Log time</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExpense(a.personnel_id)}>Add expense</DropdownMenuItem>
              {a.mission_day === today
                ? <DropdownMenuItem onClick={() => setMission.mutate({ id: a.id, location_id: locationId, day: null, note: null })}>Clear off-site mission</DropdownMenuItem>
                : <DropdownMenuItem onClick={() => setMissionDlg({ a, note: '' })}>Off-site mission today…</DropdownMenuItem>}
              <DropdownMenuSeparator />
              {a.demobilized
                ? <DropdownMenuItem disabled={!projectId} onClick={() => projectId && setStatus.mutate({ personnelIds: [a.personnel_id], status: 'activated', project_id: projectId, note: 'Reactivated from location roster' })}>Reactivate</DropdownMenuItem>
                : <DropdownMenuItem disabled={!projectId} onClick={() => setEndDlg({ a, date: today, demob: true })}>Demobilize as of…</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => setEndDlg({ a, date: today, demob: false })}>Remove from site as of…</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => onUnassign(a)}>Unassign…</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu>}
        </div>
    ); } },
  ];

  const selectedPeople = assignments.filter((a, i, all) => sel.has(a.personnel_id) && all.findIndex(b => b.personnel_id === a.personnel_id) === i)
    .map(a => ({ id: a.personnel_id, first_name: a.personnel?.first_name ?? '', last_name: a.personnel?.last_name ?? '', phone: phones[a.personnel_id] ?? null }));
  const worksFor = (p: { id: string }) => agencies.employerName(p.id) || agencies.agencyName(p.id) || 'FRG';

  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">{groups.map(([role, list]) => <Badge key={role} variant="outline">{role}: {list.length}{byRole[role]?.needed ? `/${byRole[role].needed}` : ''}</Badge>)}</div>
    <EnhancedDataTable tableId={`location-roster:${locationId}`} data={assignments.map(a => ({ ...a, id: a.personnel_id, assignment: a }))} columns={columns}
      selectable={canWrite} selectedIds={sel} onSelectionChange={setSel} exportName="location-roster" searchPlaceholder="Search roster…"
      attention={a => !phones[a.personnel_id] ? 'Missing phone' : null}
      bulkActions={(_, clear) => <><Button size="sm" variant="outline" onClick={() => onText([...sel])}><MessageSquare className="h-3.5 w-3.5 mr-1" />Text this site</Button><PersonnelBulkActions people={selectedPeople} worksFor={worksFor} onDone={clear} /></>}
    />
    <section className="border rounded-md bg-card" aria-label="Assets group">
      <h3 className="flex items-center justify-between px-3 py-2 text-sm font-semibold border-b bg-muted/40">Assets / Trucks<Badge variant="secondary">{assets.data?.length ?? 0}</Badge></h3>
      {assets.isLoading ? <Loader2 className="m-3 h-4 w-4 animate-spin" /> : !assets.data?.length ? <p className="px-3 py-2 text-sm text-muted-foreground">No equipment assigned. Manage in the Assets tab.</p> :
        <ul className="divide-y">{assets.data.map(r => <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm"><Truck className="h-4 w-4 text-muted-foreground" />{assetCareLabel(r.assets?.label ?? 'Asset', r.personnel)}<Badge variant="outline">{ownershipText(r.assets)}</Badge>{r.assets?.type && <span className="text-xs text-muted-foreground">· {r.assets.type}</span>}</li>)}</ul>}
    </section>

    <Dialog open={!!roleDlg} onOpenChange={o => !o && !changeRole.isPending && setRoleDlg(null)}><DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Change position</DialogTitle></DialogHeader>
      {roleDlg && <div className="space-y-3">
        <div><Label>New position</Label><RoleSelect value={roleDlg.role} canEdit priorityRoles={reqRoles} onChange={role => setRoleDlg({ ...roleDlg, role })} /></div>
        <div className="grid grid-cols-2 gap-2"><div><Label htmlFor="role-date">Effective from</Label><Input id="role-date" type="date" value={roleDlg.date} onChange={e => setRoleDlg({ ...roleDlg, date: e.target.value })} /></div>
          <div><Label htmlFor="role-time">Time (24h)</Label><Time24Input id="role-time" value={roleDlg.time} onChange={e => setRoleDlg({ ...roleDlg, time: e.target.value })} /></div></div>
        <p className="text-xs text-muted-foreground">Earlier days keep "{roleDlg.a.role_label || 'No role'}" on timesheets and sheets. {tz}</p>
      </div>}
      <DialogFooter><Button variant="outline" onClick={() => setRoleDlg(null)}>Cancel</Button>
        <Button disabled={!roleDlg || roleDlg.role === roleDlg.a.role_label || !isHHmm(roleDlg.time) || !roleDlg.date || changeRole.isPending} onClick={() => {
          if (!roleDlg) return; const at = locationTimeIso(roleDlg.date, roleDlg.time, tz); if (!at) return;
          changeRole.mutate({ assignment: roleDlg.a, role_label: roleDlg.role, effective_from: at }, { onSuccess: () => setRoleDlg(null) });
        }}>{changeRole.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save</Button></DialogFooter>
    </DialogContent></Dialog>

    <Dialog open={!!missionDlg} onOpenChange={o => !o && setMissionDlg(null)}><DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Off-site mission today</DialogTitle></DialogHeader>
      {missionDlg && <div><Label htmlFor="mission-note">Where / what</Label><Input id="mission-note" maxLength={200} value={missionDlg.note} onChange={e => setMissionDlg({ ...missionDlg, note: e.target.value })} placeholder="e.g. Supply run to Lakeland depot" /></div>}
      <DialogFooter><Button variant="outline" onClick={() => setMissionDlg(null)}>Cancel</Button>
        <Button disabled={!missionDlg?.note.trim() || setMission.isPending} onClick={() => missionDlg && setMission.mutate({ id: missionDlg.a.id, location_id: locationId, day: today, note: missionDlg.note.trim() }, { onSuccess: () => setMissionDlg(null) })}>Save</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!endDlg} onOpenChange={o => !o && setEndDlg(null)}><DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>{endDlg?.demob ? 'Demobilize' : 'Remove from site'}{endDlg ? ` · ${[endDlg.a.personnel?.first_name, endDlg.a.personnel?.last_name].filter(Boolean).join(' ')}` : ''}</DialogTitle></DialogHeader>
      {endDlg && <div className="space-y-2">
        <Label htmlFor="end-date">Last day on site</Label>
        <Input id="end-date" type="date" max={today} value={endDlg.date} onChange={e => setEndDlg({ ...endDlg, date: e.target.value })} />
        <p className="text-xs text-muted-foreground">From the next day on they stop counting toward staffing and drop off attendance lists, rosters and shift texts. All time through this day stays on timesheets. Backdating is allowed.</p>
      </div>}
      <DialogFooter><Button variant="outline" onClick={() => setEndDlg(null)}>Cancel</Button>
        <Button variant="destructive" disabled={!endDlg?.date || endAssignment.isPending || setStatus.isPending} onClick={() => void runEnd()}>{(endAssignment.isPending || setStatus.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Confirm</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
