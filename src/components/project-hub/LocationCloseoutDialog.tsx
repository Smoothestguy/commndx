import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { EditStayTimesDialog } from '@/components/personnel/lifecycle/EditStayTimesDialog';
import { useActOnLocationRequest, KIND_LABEL, type LocationRequest } from '@/hooks/useLocationRequests';
import { loadLocationAuthorization } from '@/hooks/useLocationAuthorization';
import { saveManualRequirements } from '@/lib/manualRequirementSave';
import { demobLines, closeoutBlocked } from '@/lib/closeout';
import { closeBlockers } from '@/hooks/useReconciliation';
import { localDay, midnight, nextDay } from '@/lib/signinSheets';
import { weekStart } from '@/lib/shifts';
import type { ProjectLocation } from '@/integrations/supabase/hooks/useProjectLocations';

const Step = ({ n, title, ok, children, optional }: { n: number; title: string; ok: boolean; optional?: boolean; children: React.ReactNode }) => (
  <section className="space-y-2 py-3" aria-label={title}>
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      {ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : optional ? <Info className="h-4 w-4 text-muted-foreground" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
      {n}. {title}
    </h3>
    <div className="pl-6 text-sm space-y-2">{children}</div>
  </section>
);

/** Formal location close-out: resolve blockers, final demob task order, end assignments, then mark closed. Never deletes history. */
export function LocationCloseoutDialog({ projectId, location, open, onOpenChange }: { projectId: string; location: ProjectLocation; open: boolean; onOpenChange: (o: boolean) => void }) {
  const tz = location.timezone || 'America/Chicago';
  const qc = useQueryClient();
  const [date, setDate] = useState(() => localDay(new Date().toISOString(), tz));
  const [notes, setNotes] = useState('');
  const [fix, setFix] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const act = useActOnLocationRequest();
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);

  const q = useQuery({
    queryKey: ['location-closeout', location.id, date], enabled: open && validDate, refetchInterval: open ? 30000 : false,
    queryFn: async () => {
      const [punches, reqs, joins, people, assets, reqRows] = await Promise.all([
        supabase.from('personnel_location_trail').select('visit_personnel_id,first_name,last_name,in_at').eq('location_id', location.id).is('out_at', null).limit(200),
        supabase.from('location_requests').select('*').eq('location_id', location.id).in('status', ['open', 'accepted']),
        supabase.from('project_join_requests').select('id,status').eq('location_id', location.id).eq('status', 'pending'),
        supabase.from('location_assignments').select('id,personnel_id,role_label').eq('location_id', location.id).eq('status', 'active').is('unassigned_at', null),
        supabase.from('asset_assignments').select('id,asset_id,assets(label)').eq('location_id', location.id).eq('status', 'active').is('unassigned_at', null).is('end_at', null),
        supabase.from('location_requirements').select('id,role_label,headcount_needed,bill_rate,notes').eq('location_id', location.id),
      ]);
      for (const r of [punches, reqs, joins, people, assets, reqRows]) if (r.error) throw r.error;
      const ids = (people.data ?? []).map(p => p.personnel_id);
      const dir = ids.length ? await supabase.from('personnel_directory').select('id,first_name,last_name').in('id', ids) : { data: [], error: null };
      if (dir.error) throw dir.error;
      const levels = await loadLocationAuthorization(location.id, date);
      return {
        punches: (punches.data ?? []).map(p => ({ id: p.visit_personnel_id!, name: [p.first_name, p.last_name].filter(Boolean).join(' '), in_at: p.in_at! })),
        requests: (reqs.data ?? []) as LocationRequest[], joins: joins.data?.length ?? 0,
        people: (people.data ?? []).map(p => { const d = dir.data?.find(x => x.id === p.personnel_id); return { id: p.id, personnel_id: p.personnel_id, role: p.role_label, name: [d?.first_name, d?.last_name].filter(Boolean).join(' ') || 'Unnamed' }; }),
        assets: (assets.data ?? []).map((a: any) => ({ id: a.id as string, label: (a.assets?.label as string) || 'Asset' })),
        levels, requirements: reqRows.data ?? [],
      };
    },
  });
  // Unresolved time variances (project-wide reconciliation) for this location's people in the close-out week.
  const recon = useQuery({
    queryKey: ['location-closeout-recon', projectId, validDate ? weekStart(date) : ''], enabled: open && validDate,
    queryFn: async () => { const { data, error } = await supabase.functions.invoke('reconcile-signin', { body: { action: 'read', project_id: projectId, week: weekStart(date) } }); if (error) throw error; return data as { rows: any[]; resolutions: any[] }; },
  });
  const d = q.data;
  const lines = useMemo(() => d?.levels ? demobLines(d.levels) : [], [d]);
  const reqsToZero = (d?.requirements ?? []).filter(r => r.headcount_needed > 0);
  const variances = useMemo(() => { if (!recon.data || !d) return []; const ids = new Set(d.people.map(p => p.personnel_id)); return closeBlockers(recon.data.rows, recon.data.resolutions).filter(v => ids.has(v.personnel_id) || !ids.size); }, [recon.data, d]);
  const blockers = { openPunches: d?.punches.length ?? 0, fieldRequests: d?.requests.length ?? 0, joinRequests: d?.joins ?? 0 };
  const blocked = !d || closeoutBlocked(blockers);
  const base = `/projects/${projectId}/locations/${location.id}`;

  const run = async () => {
    if (!d || blocked || !validDate) return;
    setBusy(true);
    const done: string[] = [];
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Please sign in again');
      // 1. Final demobilization task order (or zero manual requirements when no task orders govern this site).
      if (d.levels) {
        if (lines.length) {
          const id = crypto.randomUUID();
          const h = await supabase.from('location_task_orders').insert({ id, location_id: location.id, to_number: `CLOSE-${date.replace(/-/g, '')}`, kind: 'demobilization', effective_date: date, created_via: 'internal', created_by: user.id, status: 'rejected', notes: `Close-out task order${notes.trim() ? ` · ${notes.trim()}` : ''}` });
          if (h.error) throw h.error;
          const l = await supabase.from('location_task_order_lines').insert(lines.map(x => ({ ...x, task_order_id: id })));
          if (l.error) throw l.error;
          const a = await supabase.from('location_task_orders').update({ status: 'accepted' }).eq('id', id).select('id');
          if (a.error || !a.data?.length) throw a.error || new Error('Close-out task order could not be accepted');
        }
      } else if (reqsToZero.length) {
        await saveManualRequirements(location.id, d.requirements.map(r => ({ ...r, headcount_needed: 0 })), d.requirements);
      }
      done.push('demob task order');
      // 2. End every active assignment as of the close-out day (history retained).
      const endAt = new Date(midnight(nextDay(date), tz)).toISOString();
      if (d.people.length) { const r = await supabase.from('location_assignments').update({ status: 'unassigned', unassigned_at: endAt }).in('id', d.people.map(p => p.id)); if (r.error) throw r.error; }
      if (d.assets.length) { const r = await supabase.from('asset_assignments').update({ status: 'returned', unassigned_at: endAt, end_at: endAt, unassigned_by: user.id }).in('id', d.assets.map(a => a.id)); if (r.error) throw r.error; }
      done.push('assignments ended');
      // 3. Close (server re-checks open punches and pending requests).
      const c = await supabase.from('project_locations').update({ status: 'closed', closeout_date: date, closeout_notes: notes.trim() || null }).eq('id', location.id);
      if (c.error) throw c.error;
      await supabase.from('audit_logs').insert({ user_id: user.id, user_email: user.email || 'unknown', action_type: 'location_closeout', resource_type: 'project_locations', resource_id: location.id, changes_after: { closeout_date: date, notes: notes.trim() || null, demob_lines: lines, requirements_zeroed: d.levels ? 0 : reqsToZero.length, people_ended: d.people.length, assets_ended: d.assets.length }, metadata: { project_id: projectId }, success: true });
      toast.success(`${location.name} closed out`);
      onOpenChange(false);
    } catch (e) {
      toast.error(`${done.length ? `Completed: ${done.join(', ')}. ` : ''}Close-out stopped: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
      for (const k of ['project-locations', 'location-closeout', 'location-assignments', 'location-staffing-summary', 'location-authorization', 'location-task-orders', 'location-requirements', 'asset-assignments', 'location-command-center']) qc.invalidateQueries({ queryKey: [k] });
    }
  };

  return <>
    <Dialog open={open} onOpenChange={o => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Close out · {location.name}</DialogTitle>
          <DialogDescription>Resolve the items below, then close. Nothing is deleted: timesheets, sign-in sheets, documents and history stay viewable and exportable.</DialogDescription></DialogHeader>
        <div><Label htmlFor="closeout-date">Close-out date (last day on site)</Label><Input id="closeout-date" type="date" className="w-48" value={date} onChange={e => e.target.value && setDate(e.target.value)} /></div>
        {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : q.error ? <p role="alert" className="text-sm text-destructive">Close-out checklist could not be loaded.</p> : d && <div className="divide-y">
          <Step n={1} title={`Open punches (${d.punches.length})`} ok={!d.punches.length}>
            {d.punches.length ? <ul className="space-y-1">{d.punches.map(p => <li key={p.id} className="flex items-center justify-between gap-2"><span>{p.name} · in {localDay(p.in_at, tz)} {new Date(p.in_at).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' })}</span><Button size="sm" variant="outline" onClick={() => setFix({ id: p.id, name: p.name })}>Close / fix</Button></li>)}</ul> : <p className="text-muted-foreground">No open punches.</p>}
          </Step>
          <Step n={2} title={`Pending requests (${d.requests.length + d.joins})`} ok={!d.requests.length && !d.joins}>
            {d.requests.map(r => <div key={r.id} className="flex items-center justify-between gap-2"><span>{KIND_LABEL[r.kind]} · {r.qty} × {r.label || '—'} <Badge variant="outline" className="ml-1 capitalize">{r.status}</Badge></span>
              <span className="flex gap-1">{r.status === 'open' && <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, status: 'denied' }, { onSettled: () => void q.refetch() })}>Deny</Button>}<Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, status: 'done' }, { onSettled: () => void q.refetch() })}>Mark done</Button></span></div>)}
            {d.joins > 0 && <p>{d.joins} pending join request{d.joins === 1 ? '' : 's'} — approve or deny on the <Link className="text-primary underline" to={`/projects/${projectId}?tab=deployment`}>project join requests</Link>.</p>}
            {!d.requests.length && !d.joins && <p className="text-muted-foreground">No pending field or join requests.</p>}
          </Step>
          <Step n={3} title="Times reconciled" ok={!variances.length} optional>
            {recon.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : recon.error ? <p className="text-muted-foreground">Reconciliation unavailable.</p> : variances.length ? <>
              <p>{variances.length} unresolved variance{variances.length === 1 ? '' : 's'} for this crew in the week of {weekStart(date)}: {[...new Set(variances.map(v => v.name))].slice(0, 6).join(', ')}{variances.length > 6 ? '…' : ''}</p>
              <Link className="text-primary underline" to={`/projects/${projectId}?tab=deployment`}>Review in reconciliation</Link><p className="text-xs text-muted-foreground">Recommended before payroll close; does not block the location close-out.</p></> : <p className="text-muted-foreground">No unresolved variances this week.</p>}
          </Step>
          <Step n={4} title="Final demobilization (close-out task order)" ok>
            {d.levels ? lines.length ? <><p>Accepted task order <b>CLOSE-{date.replace(/-/g, '')}</b> effective {date}, created internally:</p><ul className="list-disc pl-5">{lines.map(l => <li key={l.line_kind + l.label}>{l.label} ({l.line_kind}) {l.qty_delta}</li>)}</ul></> : <p className="text-muted-foreground">Nothing remains authorized; no task order needed.</p>
              : reqsToZero.length ? <><p>No accepted task orders govern this site — location requirements will be set to zero (recorded in adjustment history):</p><ul className="list-disc pl-5">{reqsToZero.map(r => <li key={r.id}>{r.role_label}: {r.headcount_needed} → 0</li>)}</ul></> : <p className="text-muted-foreground">No requirements remain.</p>}
          </Step>
          <Step n={5} title={`End active assignments as of ${date}`} ok>
            {d.people.length || d.assets.length ? <ul className="list-disc pl-5">{d.people.map(p => <li key={p.id}>{p.name}{p.role ? ` · ${p.role}` : ''}</li>)}{d.assets.map(a => <li key={a.id}>{a.label} (asset)</li>)}</ul> : <p className="text-muted-foreground">No active assignments.</p>}
            <p className="text-xs text-muted-foreground">Visits, time entries and signatures through {date} stay intact.</p>
          </Step>
          <Step n={6} title="Closing notes & final records" ok optional>
            <Textarea aria-label="Closing notes" rows={2} maxLength={1000} placeholder="Optional closing notes" value={notes} onChange={e => setNotes(e.target.value)} />
            <div className="flex flex-wrap gap-3 text-xs"><Link className="text-primary underline" to={`${base}?action=daily&day=${date}`} onClick={() => onOpenChange(false)}>Final daily timesheet</Link><Link className="text-primary underline" to={`${base}?tab=attendance&view=detail`} onClick={() => onOpenChange(false)}>Attendance & exports</Link><Link className="text-primary underline" to={`${base}?tab=sheets`} onClick={() => onOpenChange(false)}>Sign-in sheets</Link></div>
          </Step>
        </div>}
        <DialogFooter className="items-center gap-2">
          {blocked && d && <span className="text-xs text-warning mr-auto">Resolve open punches and pending requests to close.</span>}
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={busy || blocked || !validDate} onClick={() => void run()}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Close out location</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {fix && <EditStayTimesDialog projectId={projectId} ids={[fix.id]} personName={fix.name} onClose={() => { setFix(null); void q.refetch(); }} />}
  </>;
}
