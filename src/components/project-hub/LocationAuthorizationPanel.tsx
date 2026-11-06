import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useLocationAssignments } from '@/integrations/supabase/hooks/useLocationStaffing';
import { localDay } from '@/lib/signinSheets';
import { taskOrderWhen } from '@/lib/taskOrderExtras';
import { LocationTaskOrders } from './LocationTaskOrders';

type Level = { line_kind: string; label: string; authorized: number };
const key = (l: { line_kind: string; label: string }) => `${l.line_kind}:${l.label}`;

function Diff({ actual, authorized }: { actual: number; authorized: number }) {
  if (actual > authorized) return <Badge variant="outline" className="text-destructive border-destructive/40">OVER +{actual - authorized}</Badge>;
  if (actual < authorized) return <Badge variant="outline" className="text-warning border-warning/40">UNDER −{authorized - actual}</Badge>;
  return <Badge variant="outline" className="text-success border-success/40">OK</Badge>;
}

/** As-of-today task-order authorization vs actual, upcoming changes and full history. */
export function LocationAuthorizationPanel({ projectId, locationId, locationName, timezone }: { projectId: string; locationId: string; locationName: string; timezone?: string | null }) {
  const { isAdmin, isManager } = useUserRole(), canWrite = isAdmin || isManager;
  const tz = timezone || 'America/Chicago';
  const today = localDay(new Date().toISOString(), tz);
  const [open, setOpen] = useState(false);
  const [newSignal, setNewSignal] = useState(0);
  const { data: roster = [] } = useLocationAssignments(locationId);
  const data = useQuery({
    queryKey: ['location-auth-panel', locationId, today], refetchInterval: 60000,
    queryFn: async () => {
      const [orders, levels, assets, visits] = await Promise.all([
        supabase.from('location_task_orders').select('id,to_number,kind,status,effective_date,effective_time,travel_time,location_task_order_lines(line_kind,label,qty_delta)').eq('location_id', locationId).eq('status', 'accepted').order('effective_date'),
        supabase.rpc('location_authorized_asof', { p_location: locationId, p_date: today }),
        supabase.from('asset_assignments').select('id').eq('location_id', locationId).eq('status', 'active').is('unassigned_at', null).is('end_at', null),
        supabase.from('personnel_location_trail').select('personnel_id,in_at,out_at').eq('location_id', locationId).gte('in_at', new Date(Date.now() - 2 * 864e5).toISOString()),
      ]);
      for (const r of [orders, levels, assets, visits]) if (r.error) throw r.error;
      const upcoming = (orders.data ?? []).filter(o => o.effective_date > today);
      const after = await Promise.all(upcoming.map(async o => { const r = await supabase.rpc('location_authorized_asof', { p_location: locationId, p_date: o.effective_date }); if (r.error) throw r.error; return { order: o, levels: (r.data ?? []) as Level[] }; }));
      const onSite = new Set((visits.data ?? []).filter(v => v.in_at && localDay(v.in_at, tz) === today).map(v => v.personnel_id));
      return { hasOrders: (orders.data ?? []).length > 0, levels: (levels.data ?? []) as Level[], assets: assets.data?.length ?? 0, onSite: onSite.size, after };
    },
  });
  const byRole = useMemo(() => { const m: Record<string, number> = {}; for (const a of roster) { if (a.demobilized) continue; const r = a.role_label || 'Unassigned role'; m[r] = (m[r] || 0) + 1; } return m; }, [roster]);
  const actualFor = (l: { line_kind: string; label: string }) => l.line_kind === 'asset' ? (data.data?.assets ?? 0) : (byRole[l.label] ?? 0);
  const d = data.data;
  const levels = d?.levels ?? [];
  const positions = levels.filter(l => l.line_kind === 'position').reduce((s, l) => s + l.authorized, 0);
  const assetLevels = levels.filter(l => l.line_kind === 'asset');
  const assetAuthorized = assetLevels.reduce((s, l) => s + l.authorized, 0);
  // Asset actual is location-wide, so compare once against total authorized assets.
  const lines = [...levels.filter(l => l.line_kind === 'position'), ...(assetLevels.length ? [{ line_kind: 'asset', label: assetLevels.map(a => a.label).join(' / '), authorized: assetAuthorized }] : [])];
  const unbacked = Object.entries(byRole).filter(([r]) => !levels.some(l => l.line_kind === 'position' && l.label === r));

  return <section aria-label="Authorization" className="border rounded-lg p-4 space-y-3 bg-card">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold">Task-order authorization</h2>
      {canWrite && <Button size="sm" onClick={() => { setOpen(true); setNewSignal(n => n + 1); }}><Plus className="h-4 w-4 mr-1" />New task order</Button>}
    </div>
    {data.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : data.error ? <p role="alert" className="text-sm text-destructive">Authorization could not be loaded.</p> : !d?.hasOrders ? <p className="text-sm text-muted-foreground">No accepted task orders. Staffing follows the requirements set on this location.</p> : <>
      <p className="text-lg sm:text-xl font-semibold leading-snug">Today: {roster.filter(a => !a.demobilized).length} staffed · {d.onSite} on site · Authorized {lines.map(l => `${l.authorized} ${l.label}`).join(' / ') || 'none'}</p>
      <p className="text-xs text-muted-foreground">{positions} positions authorized{assetAuthorized ? ` + ${assetAuthorized} assets` : ''} · compared with active assignments and active equipment.</p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {lines.map(l => { const a = actualFor(l); return <li key={key(l)} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"><span className="text-sm"><span className="font-medium">{l.label}</span> <span className="tabular-nums">{a}/{l.authorized}</span></span><Diff actual={a} authorized={l.authorized} /></li>; })}
        {unbacked.map(([r, n]) => <li key={r} className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 px-3 py-2"><span className="text-sm"><span className="font-medium">{r}</span> {n}/0</span><Badge variant="outline" className="text-destructive border-destructive/40">Not authorized</Badge></li>)}
      </ul>
      {d.after.map(({ order, levels: next }) => {
        const delta = order.location_task_order_lines.map(l => `${l.qty_delta > 0 ? '+' : '−'}${Math.abs(l.qty_delta)} ${l.label}`).join(' / ');
        const nextPos = next.filter(l => l.line_kind === 'position');
        const overs = nextPos.map(l => ({ label: l.label, over: (byRole[l.label] ?? 0) - l.authorized })).filter(o => o.over > 0);
        const nextAssets = next.filter(l => l.line_kind === 'asset').reduce((s, l) => s + l.authorized, 0);
        if (d.assets > nextAssets) overs.push({ label: 'assets', over: d.assets - nextAssets });
        return <div key={order.id} className="rounded-md border border-warning/50 bg-warning/5 p-3 text-sm space-y-1">
          <p className="font-medium"><AlertTriangle className="inline h-4 w-4 mr-1 text-warning" />{taskOrderWhen(order.effective_date, order.effective_time)}: {order.kind[0].toUpperCase() + order.kind.slice(1)} ({order.to_number}) — {delta} → authorization becomes {next.map(l => `${l.authorized} ${l.label}`).join(' / ') || 'none'}{order.travel_time != null ? ` (travel time: ${order.travel_time ? 'yes' : 'no'})` : ''}</p>
          {overs.length > 0 && <p className="text-destructive">{overs.map(o => `${o.over} ${o.label} over`).join(', ')} as of {taskOrderWhen(order.effective_date, null)} — plan demobilization.</p>}
        </div>;
      })}
    </>}
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="px-0"><ChevronDown className={`h-4 w-4 mr-1 transition-transform ${open ? 'rotate-180' : ''}`} />Task-order history</Button></CollapsibleTrigger>
      <CollapsibleContent className="pt-2"><LocationTaskOrders projectId={projectId} locationId={locationId} locationName={locationName} timezone={timezone} inline newSignal={newSignal} /></CollapsibleContent>
    </Collapsible>
  </section>;
}
