import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { MapPin, MapPinOff, Inbox, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatLocalDate } from '@/lib/dateUtils';
import { locationHref } from '@/lib/navigationState';
import { currentWeekStart } from '@/lib/shifts';
import type { ProjectLocation } from '@/integrations/supabase/hooks/useProjectLocations';
import type { LocationStaffingSummary } from '@/integrations/supabase/hooks/useLocationStaffing';
import { useLocationAuthorization } from '@/hooks/useLocationAuthorization';
import { useLocationCommandCenter } from '@/hooks/useLocationCommandCenter';
import { useLocationRequests, KIND_LABEL } from '@/hooks/useLocationRequests';
import { useReconciliation, closeBlockers } from '@/hooks/useReconciliation';
import { attention, roleGaps, sortByAttention, worstRole, type Severity } from '@/lib/commandCenter';
import { FieldRequestsDialog, RequestActions } from './FieldRequestsDialog';

type FilterKey = 'attention' | 'under' | 'over' | 'assets' | 'join' | 'punches' | 'tos' | 'ext' | 'late' | 'requests';
const KIND_SHORT: Record<string, string> = { initial: 'Initial', increase: 'Increase', decrease: 'Decrease', demobilization: 'Demobe' };
const tone: Record<Severity, string> = { red: 'text-destructive border-destructive/40 bg-destructive/10', amber: 'text-warning border-warning/40 bg-warning/10', ok: 'text-success border-success/40' };

export function LocationsCommandCenter({ projectId, locations, staffing, canWrite }: {
  projectId: string; locations: ProjectLocation[]; staffing?: Record<string, LocationStaffingSummary>; canWrite: boolean;
}) {
  const navigate = useNavigate();
  const auth = useLocationAuthorization(locations);
  const ops = useLocationCommandCenter(projectId, locations);
  const reqs = useLocationRequests(locations.map(l => l.id));
  const recon = useReconciliation(projectId, currentWeekStart(), canWrite);
  const blocks = recon.data ? closeBlockers(recon.data.rows, recon.data.resolutions).length : 0;
  const [filter, setFilter] = useState<FilterKey | null>(null);
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('active');
  const [reqFor, setReqFor] = useState<ProjectLocation | null>(null);

  const rows = useMemo(() => sortByAttention(locations.map(l => {
    const s = staffing?.[l.id], a = auth.data?.[l.id], o = ops.data?.[l.id];
    const gaps = roleGaps(a?.levels, s?.byRole ?? {});
    const worst = worstRole(gaps);
    const authorized = a ? a.positions : (s?.needed ?? 0);
    const actual = a ? a.actual : (s?.assigned ?? 0);
    const openReqs = (reqs.data ?? []).filter(r => r.location_id === l.id && (r.status === 'open' || r.status === 'accepted'));
    const severity = attention({ staffSeverity: worst.severity, assetUnder: a?.assetUnder ?? 0, assetOver: a?.assetOver ?? 0, late: o?.late ?? 0,
      joinPending: o?.joinPending ?? 0, openPunches: o?.openPunches ?? 0, pendingTOs: o?.pendingTOs ?? 0, extPending: o?.extPending ?? 0, openRequests: openReqs.filter(r => r.status === 'open').length });
    return { l, name: l.name, severity, gaps, worst, authorized, actual, a, o, openReqs, notChecked: Math.max(0, (s?.assigned ?? 0) - (o?.checkedToday ?? 0)) };
  })), [locations, staffing, auth.data, ops.data, reqs.data]);

  const live = useMemo(() => rows.filter(r => r.l.status !== 'closed'), [rows]);
  const closedRows = useMemo(() => rows.filter(r => r.l.status === 'closed').sort((a, b) => a.name.localeCompare(b.name)), [rows]);
  const [showClosed, setShowClosed] = useState(false);
  const totals = useMemo(() => ({
    crew: live.reduce((n, r) => n + (staffing?.[r.l.id]?.assigned ?? 0), 0),
    under: live.filter(r => r.gaps.some(g => g.under > 0)).length,
    over: live.filter(r => r.gaps.some(g => g.over > 0)).length,
    assets: live.reduce((n, r) => n + (r.a?.assetUnder ?? 0), 0),
    join: live.reduce((n, r) => n + (r.o?.joinPending ?? 0), 0),
    punches: live.reduce((n, r) => n + (r.o?.openPunches ?? 0), 0),
    tos: live.reduce((n, r) => n + (r.o?.pendingTOs ?? 0), 0),
    ext: live.reduce((n, r) => n + (r.o?.extPending ?? 0), 0),
    late: live.reduce((n, r) => n + (r.o?.late ?? 0), 0),
    requests: live.reduce((n, r) => n + r.openReqs.filter(q => q.status === 'open').length, 0),
    attention: live.filter(r => r.severity !== 'ok').length,
  }), [live, staffing]);

  const match = (r: (typeof rows)[number]) => {
    if (r.l.status === 'closed') return false;
    if (status === 'active' && r.l.status !== 'active') return false;
    if (status === 'inactive' && r.l.status === 'active') return false;
    switch (filter) {
      case 'attention': return r.severity !== 'ok';
      case 'under': return r.gaps.some(g => g.under > 0);
      case 'over': return r.gaps.some(g => g.over > 0);
      case 'assets': return (r.a?.assetUnder ?? 0) > 0;
      case 'join': return (r.o?.joinPending ?? 0) > 0;
      case 'punches': return (r.o?.openPunches ?? 0) > 0;
      case 'tos': return (r.o?.pendingTOs ?? 0) > 0;
      case 'ext': return (r.o?.extPending ?? 0) > 0;
      case 'late': return (r.o?.late ?? 0) > 0;
      case 'requests': return r.openReqs.length > 0;
      default: return true;
    }
  };
  const visible = rows.filter(match);
  const pl = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const chips: { key: FilterKey; n: number; text: string; sev: Severity }[] = [
    { key: 'under', n: totals.under, text: `${pl(totals.under, 'location')} under personnel`, sev: 'amber' },
    { key: 'over', n: totals.over, text: `${totals.over} over authorization`, sev: 'red' },
    { key: 'assets', n: totals.assets, text: `${pl(totals.assets, 'asset')} under`, sev: 'amber' },
    { key: 'requests', n: totals.requests, text: `${pl(totals.requests, 'field request')} open`, sev: 'amber' },
    { key: 'join', n: totals.join, text: `${pl(totals.join, 'join request')} pending`, sev: 'amber' },
    { key: 'tos', n: totals.tos, text: `${totals.tos} TO awaiting acceptance`, sev: 'amber' },
    { key: 'ext', n: totals.ext, text: `${pl(totals.ext, 'shift extension')} pending`, sev: 'amber' },
    { key: 'late', n: totals.late, text: `${totals.late} late today`, sev: 'amber' },
    { key: 'punches', n: totals.punches, text: `${pl(totals.punches, 'open punch')}`.replace('punchs', 'punches'), sev: 'ok' },
  ];
  const toggle = (k: FilterKey) => setFilter(f => (f === k ? null : k));

  const StaffCell = ({ r }: { r: (typeof rows)[number] }) => (
    <Tooltip><TooltipTrigger asChild>
      <span className="inline-flex items-center gap-1.5 cursor-default">
        <span className="tabular-nums font-semibold">{r.actual}/{r.authorized}</span>
        {r.worst.label && <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px] font-semibold', tone[r.worst.severity])}>{r.worst.label}</Badge>}
      </span>
    </TooltipTrigger><TooltipContent>
      {r.gaps.length ? r.gaps.map(g => <div key={g.role} className="tabular-nums">{g.role}: {g.actual}/{g.authorized}{g.over ? ` · ${g.over} over` : g.under ? ` · ${g.under} under` : ''}</div>) : 'No authorized positions'}
      <div className="text-muted-foreground mt-1">{r.a ? 'Authorized by accepted task orders' : 'From location requirements'}</div>
    </TooltipContent></Tooltip>
  );
  const AssetCell = ({ r }: { r: (typeof rows)[number] }) => !r.a || (r.a.assets === 0 && r.a.actualAssets === 0) ? <span className="text-muted-foreground">—</span> : (
    <span className={cn('tabular-nums', r.a.assetOver ? 'text-destructive' : r.a.assetUnder ? 'text-warning' : 'text-success')}>
      {r.a.actualAssets}/{r.a.assets}{r.a.assetOver ? ` · ${r.a.assetOver} over` : r.a.assetUnder ? ` · ${r.a.assetUnder} under` : ''}
    </span>
  );
  const TodayCell = ({ r }: { r: (typeof rows)[number] }) => (
    <span className="inline-flex gap-2 text-xs tabular-nums">
      <span className="text-success" title="On site now">● {r.o?.onSite ?? 0}</span>
      <span className="text-muted-foreground" title="Not checked in today">○ {r.notChecked}</span>
      {(r.o?.late ?? 0) > 0 && <span className="text-destructive" title="Late today">{r.o!.late} late</span>}
    </span>
  );
  const OpenItems = ({ r }: { r: (typeof rows)[number] }) => {
    const o = r.o; const items: [number, string, string][] = [
      [r.openReqs.filter(q => q.status === 'open').length, 'req', 'Open field requests'], [o?.joinPending ?? 0, 'join', 'Pending join requests'],
      [o?.openPunches ?? 0, 'open', 'Open punches'], [o?.pendingTOs ?? 0, 'TO', 'Customer task orders awaiting acceptance'], [o?.extPending ?? 0, 'ext', 'Shift-extension requests'],
    ];
    const shown = items.filter(i => i[0] > 0);
    return shown.length ? <span className="inline-flex flex-wrap gap-1">{shown.map(([n, t, title]) => <Badge key={t} variant="outline" title={title} className={cn('px-1.5 py-0 text-[10px] whitespace-nowrap', t !== 'open' && tone.amber)}>{n} {t}</Badge>)}</span> : <span className="text-muted-foreground">—</span>;
  };
  const NextCell = ({ r }: { r: (typeof rows)[number] }) => {
    const n = r.o?.next; if (!n) return <span className="text-muted-foreground md:inline hidden">—</span>;
    const pos = n.labels.filter(x => x.line_kind === 'position').sort((a, b) => a.label.localeCompare(b.label));
    return <span className="text-xs" title={n.labels.map(x => `${x.label}: ${x.authorized}`).join('\n')}>
      <span className="font-semibold text-warning">{KIND_SHORT[n.kind] ?? n.kind} {formatLocalDate(n.date, 'MM/dd')}</span> → <span className="tabular-nums">{pos.map(x => x.authorized).join('/') || '0'}</span>
    </span>;
  };
  const Dates = ({ l }: { l: ProjectLocation }) => <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{l.mobe_date ? formatLocalDate(l.mobe_date, 'M/d') : '—'} → {l.demobe_date ? formatLocalDate(l.demobe_date, 'M/d') : '—'}</span>;
  const Last = ({ r }: { r: (typeof rows)[number] }) => <span className="text-xs text-muted-foreground whitespace-nowrap">{r.o?.lastActivity ? formatDistanceToNowStrict(new Date(r.o.lastActivity), { addSuffix: true }) : '—'}</span>;
  const NameCell = ({ r }: { r: (typeof rows)[number] }) => (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className={cn('h-2 w-2 rounded-full shrink-0', r.severity === 'red' ? 'bg-destructive' : r.severity === 'amber' ? 'bg-warning' : 'bg-success')} aria-label={r.severity === 'ok' ? 'OK' : 'Needs attention'} />
      <Link to={locationHref(projectId, r.l.id)} onClick={e => e.stopPropagation()} className="font-semibold truncate hover:underline hover:text-primary">{r.l.name}</Link>
      {r.l.project_number && <span className="text-xs text-muted-foreground shrink-0">#{r.l.project_number}</span>}
      {r.l.lat != null && r.l.lng != null ? <MapPin className="h-3.5 w-3.5 text-success shrink-0" aria-label="Geofenced" /> : <MapPinOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-label="No geofence" />}
      <Badge variant={r.l.status === 'active' ? 'default' : 'secondary'} className="px-1.5 py-0 text-[10px] capitalize shrink-0">{r.l.status === 'active' ? 'Active' : r.l.status === 'closed' ? 'Closed' : 'Inactive'}</Badge>
    </div>
  );
  const ReqButton = ({ r }: { r: (typeof rows)[number] }) => (
    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={e => { e.stopPropagation(); setReqFor(r.l); }} aria-label={`Field requests for ${r.l.name}`}>
      <Inbox className="h-3.5 w-3.5 mr-1" />{r.openReqs.length || ''}
    </Button>
  );

  const openRequests = (reqs.data ?? []).filter(r => r.status === 'open' && locations.find(l => l.id === r.location_id)?.status !== 'closed');
  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-3">
        <div className="rounded-lg border bg-card p-2.5 space-y-2" aria-label="Needs across locations">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-semibold mr-1"><Users className="h-3.5 w-3.5 text-primary" />{totals.crew} crew · {pl(live.length, 'location')}</span>
            {chips.filter(c => c.n > 0).map(c => (
              <button key={c.key} type="button" onClick={() => toggle(c.key)} aria-pressed={filter === c.key}
                className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors', c.sev === 'ok' ? 'text-foreground' : tone[c.sev], filter === c.key && 'ring-2 ring-primary')}>{c.text}</button>
            ))}
            {blocks > 0 && <Link to={`/projects/${projectId}?tab=deployment`} className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', tone.amber)}>{pl(blocks, 'reconciliation block')}</Link>}
            {chips.every(c => c.n === 0) && blocks === 0 && <span className="text-xs text-success">All locations on track</span>}
          </div>
          {canWrite && openRequests.length > 0 && (
            <ul className="divide-y border-t pt-1">
              {openRequests.slice(0, 5).map(q => {
                const loc = locations.find(l => l.id === q.location_id);
                return <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs">
                  <span className="min-w-0"><Badge variant="outline" className="mr-1.5 px-1.5 py-0 text-[10px]">{KIND_LABEL[q.kind]}</Badge><span className="font-medium">{q.qty} × {q.label || KIND_LABEL[q.kind]}</span> <span className="text-muted-foreground">· {loc?.name}{q.note ? ` · ${q.note}` : ''}</span></span>
                  <RequestActions r={q} compact />
                </li>;
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Status filter">
            {(['active', 'inactive', 'all'] as const).map(s => <Button key={s} size="sm" variant={status === s ? 'secondary' : 'ghost'} className="h-7 px-2 text-xs capitalize" onClick={() => setStatus(s)}>{s}</Button>)}
          </div>
          <Button size="sm" variant={filter === 'attention' ? 'secondary' : 'outline'} className="h-7 px-2 text-xs" onClick={() => toggle('attention')} aria-pressed={filter === 'attention'}>Needs attention ({totals.attention})</Button>
          {filter && filter !== 'attention' && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setFilter(null)}>Clear filter</Button>}
          <span className="text-xs text-muted-foreground ml-auto">{visible.length} shown</span>
        </div>

        <div className="hidden md:block border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground text-left">
              <tr><th className="px-2 py-1.5 font-medium">Location</th><th className="px-2 py-1.5 font-medium">Staffed</th><th className="px-2 py-1.5 font-medium">Today</th><th className="px-2 py-1.5 font-medium">Assets</th><th className="px-2 py-1.5 font-medium">Open items</th><th className="px-2 py-1.5 font-medium">Upcoming</th><th className="px-2 py-1.5 font-medium">Mobe → Demobe</th><th className="px-2 py-1.5 font-medium">POC</th><th className="px-2 py-1.5 font-medium">Last activity</th><th className="px-2 py-1.5" /></tr>
            </thead>
            <tbody className="divide-y">
              {visible.map(r => (
                <tr key={r.l.id} className={cn('cursor-pointer hover:bg-muted/40', r.severity === 'red' && 'bg-destructive/5')} onClick={() => navigate(locationHref(projectId, r.l.id))}>
                  <td className="px-2 py-1.5 min-w-[16rem] max-w-[24rem]"><NameCell r={r} /></td>
                  <td className="px-2 py-1.5 whitespace-nowrap"><StaffCell r={r} /></td>
                  <td className="px-2 py-1.5 whitespace-nowrap"><TodayCell r={r} /></td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs"><AssetCell r={r} /></td>
                  <td className="px-2 py-1.5"><OpenItems r={r} /></td>
                  <td className="px-2 py-1.5 whitespace-nowrap"><NextCell r={r} /></td>
                  <td className="px-2 py-1.5"><Dates l={r.l} /></td>
                  <td className="px-2 py-1.5 text-xs max-w-[10rem] truncate" title={[r.l.poc_name, r.l.poc_phone].filter(Boolean).join(' · ')}>{r.l.poc_name || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-1.5"><Last r={r} /></td>
                  <td className="px-2 py-1.5 text-right"><ReqButton r={r} /></td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={10} className="px-2 py-6 text-center text-muted-foreground text-sm">No locations match.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-2">
          {visible.map(r => (
            <div key={r.l.id} role="link" tabIndex={0} onClick={() => navigate(locationHref(projectId, r.l.id))} onKeyDown={e => { if (e.key === 'Enter') navigate(locationHref(projectId, r.l.id)); }}
              className={cn('border rounded-md p-2.5 space-y-1.5 text-sm', r.severity === 'red' && 'border-destructive/40', r.severity === 'amber' && 'border-warning/40')}>
              <div className="flex items-center justify-between gap-2"><NameCell r={r} /><ReqButton r={r} /></div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><StaffCell r={r} /><TodayCell r={r} /></div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><span>Assets <AssetCell r={r} /></span><NextCell r={r} /><Dates l={r.l} /></div>
              <div className="flex flex-wrap items-center justify-between gap-2"><OpenItems r={r} /><Last r={r} /></div>
            </div>
          ))}
          {visible.length === 0 && <p className="text-center text-muted-foreground text-sm py-6">No locations match.</p>}
        </div>

        {closedRows.length > 0 && <div className="border rounded-md" aria-label="Closed locations">
          <button type="button" className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium" aria-expanded={showClosed} onClick={() => setShowClosed(v => !v)}>
            <span>Closed <span className="text-muted-foreground font-normal">({closedRows.length})</span></span><span className="text-xs text-muted-foreground">{showClosed ? 'Hide' : 'Show'}</span></button>
          {showClosed && <ul className="divide-y border-t">{closedRows.map(r => <li key={r.l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-sm text-muted-foreground">
            <Link to={locationHref(projectId, r.l.id)} className="hover:underline hover:text-primary">{r.l.name}</Link>
            <span className="text-xs">Closed{r.l.closeout_date ? ` ${r.l.closeout_date}` : ''} · <Dates l={r.l} /></span></li>)}</ul>}
        </div>}
      </div>
      {reqFor && <FieldRequestsDialog open onOpenChange={v => { if (!v) setReqFor(null); }} locationId={reqFor.id} locationName={reqFor.name} canAct={canWrite} />}
    </TooltipProvider>
  );
}
