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
import { type LocationAssignment, useChangeAssignmentRole, useSetMission } from '@/integrations/supabase/hooks/useLocationStaffing';
import { localDay, localTime } from '@/lib/signinSheets';
import { locationTimeIso } from '@/lib/manualTime';
import { isHHmm, todayStatus, type TodayStatus } from '@/lib/assignmentRoles';
import { cn } from '@/lib/utils';

type Agencies = { agencyName: (id: string) => string | null | undefined; employerName: (id: string) => string | null | undefined; nonBillableByPerson: Record<string, boolean | undefined> };

function StatusPill({ s, tz }: { s: TodayStatus; tz: string }) {
  switch (s.kind) {
    case 'checked_in': return <Badge variant="outline" className="border-success bg-success/15 text-success whitespace-nowrap">Checked in {localTime(s.at, tz)}</Badge>;
    case 'checked_out': return <Badge variant="outline" className="text-muted-foreground whitespace-nowrap">Checked out {localTime(s.at, tz)}</Badge>;
    case 'mission': return <Badge variant="outline" className="border-info/50 bg-info/10 text-info max-w-[14rem] truncate" title={s.note || undefined}>Off-site mission{s.note ? ` · ${s.note}` : ''}</Badge>;
    case 'demobilized': return <Badge variant="outline" className="bg-secondary text-secondary-foreground">Demobilized</Badge>;
    default: return <Badge variant="outline" className="border-warning/40 text-warning whitespace-nowrap">Not checked in</Badge>;
  }
}

const COLS = 'sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1fr)_5.5rem]';

export function LocationRoster({ locationId, projectId, timezone, canWrite, assignments, reqRoles, agencies, phones, texted, onText, onLog, onExpense, onUnassign }: {
  locationId: string; projectId?: string; timezone?: string | null; canWrite: boolean; assignments: LocationAssignment[]; reqRoles: string[];
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
  const assets = useQuery({
    queryKey: ['location-roster-assets', locationId],
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_assignments').select('id, assets(label,type)').eq('location_id', locationId).eq('status', 'active').is('unassigned_at', null).is('end_at', null);
      if (error) throw error;
      return (data ?? []) as { id: string; assets: { label: string | null; type: string | null } | null }[];
    },
  });

  const { groups, demob } = useMemo(() => {
    const active = assignments.filter(a => !a.demobilized);
    const by = new Map<string, LocationAssignment[]>();
    for (const a of active) { const k = a.role_label || 'No role'; by.set(k, [...(by.get(k) ?? []), a]); }
    const rank = (k: string) => /supervisor|lead|foreman/i.test(k) ? 0 : /operator/i.test(k) ? 1 : k === 'No role' ? 9 : 2;
    const name = (a: LocationAssignment) => [a.personnel?.first_name, a.personnel?.last_name].filter(Boolean).join(' ');
    return {
      groups: [...by.entries()].sort((x, y) => rank(x[0]) - rank(y[0]) || x[0].localeCompare(y[0])).map(([k, v]) => [k, v.sort((p, q) => name(p).localeCompare(name(q)))] as const),
      demob: assignments.filter(a => a.demobilized),
    };
  }, [assignments]);

  const row = (a: LocationAssignment) => {
    const name = [a.personnel?.first_name, a.personnel?.last_name].filter(Boolean).join(' ') || 'Unknown';
    const s = todayStatus({ demobilized: !!a.demobilized, stays: stays.data?.[a.personnel_id] ?? [], missionToday: a.mission_day === today, missionNote: a.mission_note ?? null });
    const elsewhere = onSite[a.personnel_id] && onSite[a.personnel_id].location_id !== locationId ? onSite[a.personnel_id].location_name : null;
    const actions = [
      { label: 'Send site text', run: () => onText([a.personnel_id]) },
      ...(canWrite ? [
        { label: 'Log time', run: () => onLog(a.personnel_id) },
        { label: 'Add expense', run: () => onExpense(a.personnel_id) },
        { label: 'Unassign', run: () => onUnassign(a), destructive: true },
      ] : []),
    ];
    return <EntityContextMenu key={a.id} href={`/personnel/${a.personnel_id}`} person actions={actions}>
      <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 px-3 py-2 items-center text-sm', COLS)}>
        <div className="min-w-0">
          <Link to={`/personnel/${a.personnel_id}`} className="font-medium hover:text-primary hover:underline truncate block">{name}</Link>
          {elsewhere && <span className="text-[11px] text-muted-foreground">At other site: {elsewhere}</span>}
          {canWrite && !phones[a.personnel_id] && <Link to={`/personnel/${a.personnel_id}`} className="block text-[11px] text-warning hover:underline">No phone · add phone</Link>}
        </div>
        <div className="flex flex-wrap gap-1 justify-end sm:justify-start sm:order-none order-3 col-span-2 sm:col-span-1">
          <AgencyChip name={agencies.agencyName(a.personnel_id)} />
          <NonBillableChip value={agencies.nonBillableByPerson[a.personnel_id]} employer={agencies.employerName(a.personnel_id)} />
        </div>
        <div className="sm:order-none order-2 justify-self-end sm:justify-self-start"><StatusPill s={s} tz={tz} /></div>
        <div className="text-xs text-muted-foreground order-4 sm:order-none"><TextedCaption at={texted[`${a.personnel_id}:${locationId}`]} /></div>
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
                : <DropdownMenuItem onClick={() => setStatus.mutate({ personnelIds: [a.personnel_id], status: 'demobilized', project_id: projectId ?? null, note: 'Demobilized from location roster' })}>Demobilize (keeps history)</DropdownMenuItem>}
              <DropdownMenuItem className="text-destructive" onClick={() => onUnassign(a)}>Unassign…</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu>}
        </div>
      </div>
    </EntityContextMenu>;
  };

  const header = <div className={cn('hidden sm:grid gap-2 px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b', COLS)}><span>Name</span><span>Agency / employer</span><span>Today here</span><span>Last texted</span><span /></div>;

  return <div className="space-y-4">
    {groups.length === 0 && <p className="text-sm text-muted-foreground">No one actively assigned.</p>}
    {groups.map(([role, list]) => <section key={role} className="border rounded-md bg-card" aria-label={`${role} group`}>
      <h3 className="flex items-center justify-between px-3 py-2 text-sm font-semibold border-b bg-muted/40">{role}s<Badge variant="secondary">{list.length}</Badge></h3>
      {header}<div className="divide-y">{list.map(row)}</div>
    </section>)}
    <section className="border rounded-md bg-card" aria-label="Assets group">
      <h3 className="flex items-center justify-between px-3 py-2 text-sm font-semibold border-b bg-muted/40">Assets / Trucks<Badge variant="secondary">{assets.data?.length ?? 0}</Badge></h3>
      {assets.isLoading ? <Loader2 className="m-3 h-4 w-4 animate-spin" /> : !assets.data?.length ? <p className="px-3 py-2 text-sm text-muted-foreground">No equipment assigned. Manage in the Assets tab.</p> :
        <ul className="divide-y">{assets.data.map(r => <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm"><Truck className="h-4 w-4 text-muted-foreground" />{r.assets?.label ?? 'Asset'}{r.assets?.type && <span className="text-xs text-muted-foreground">· {r.assets.type}</span>}</li>)}</ul>}
    </section>
    {demob.length > 0 && <Collapsible open={demobOpen} onOpenChange={setDemobOpen} className="border rounded-md bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-muted-foreground"><span>Demobilized · not counted as staffed</span><span className="flex items-center gap-2"><Badge variant="outline">{demob.length}</Badge><ChevronDown className={cn('h-4 w-4 transition-transform', demobOpen && 'rotate-180')} /></span></CollapsibleTrigger>
      <CollapsibleContent>{header}<div className="divide-y border-t">{demob.map(row)}</div></CollapsibleContent>
    </Collapsible>}

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
  </div>;
}
