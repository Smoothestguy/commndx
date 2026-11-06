import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Lock, LockOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectLocations } from '@/integrations/supabase/hooks/useProjectLocations';
import { useUserRole } from '@/hooks/useUserRole';
import { openLocations, projectSummary } from '@/lib/closeout';

/** Project close-out: offered once every location is closed; admin-only reopen. Hours come from canonical time_entries. */
export function ProjectCloseout({ project }: { project: { id: string; name: string; closed_at?: string | null; closeout_summary?: unknown } }) {
  const { isAdmin, isManager } = useUserRole();
  const qc = useQueryClient();
  const { data: locations = [] } = useProjectLocations(project.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const stillOpen = openLocations(locations);
  const summary = useQuery({
    queryKey: ['project-closeout-summary', project.id], enabled: open && !stillOpen.length,
    queryFn: async () => {
      const rows: { entry_date: string; hours: number | null }[] = [];
      for (let o = 0; ; o += 1000) {
        const { data, error } = await supabase.from('time_entries').select('entry_date,hours').eq('project_id', project.id).order('id').range(o, o + 999);
        if (error) throw error; rows.push(...(data ?? [])); if ((data ?? []).length < 1000) break;
      }
      return projectSummary(locations, rows);
    },
  });
  if (!(isAdmin || isManager)) return null;
  const refresh = () => { for (const k of ['project', 'projects', 'project-locations']) qc.invalidateQueries({ queryKey: [k] }); };
  if (project.closed_at) return isAdmin ? <Button variant="outline" disabled={busy} onClick={async () => {
    setBusy(true);
    const { error } = await supabase.from('projects').update({ closed_at: null, status: 'active', stage: 'active' }).eq('id', project.id);
    setBusy(false); if (error) { toast.error(error.message); return; } toast.success('Project reopened'); refresh();
  }}><LockOpen className="h-4 w-4 mr-2" />Reopen project</Button> : null;

  const close = async () => {
    if (!summary.data) return;
    setBusy(true);
    const { error } = await supabase.from('projects').update({ closed_at: new Date().toISOString(), status: 'completed', stage: 'complete', closeout_summary: summary.data }).eq('id', project.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${project.name} closed out`); setOpen(false); refresh();
  };
  return <>
    <Button variant="outline" onClick={() => setOpen(true)}><Lock className="h-4 w-4 mr-2" />Close out project</Button>
    <Dialog open={open} onOpenChange={o => !busy && setOpen(o)}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Close out · {project.name}</DialogTitle><DialogDescription>Marks the project completed. Nothing is deleted.</DialogDescription></DialogHeader>
      {stillOpen.length ? <div className="space-y-2 text-sm">
        <p className="text-warning font-medium">Close out every location first — {stillOpen.length} still open:</p>
        <ul className="max-h-64 overflow-y-auto divide-y border rounded-md">{stillOpen.map(l => <li key={l.id} className="flex justify-between px-3 py-1.5"><Link className="text-primary hover:underline" to={`/projects/${project.id}/locations/${l.id}`}>{l.name}</Link><span className="capitalize text-muted-foreground">{l.status}</span></li>)}</ul>
      </div> : summary.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : summary.data && <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">Dates</dt><dd>{summary.data.start ?? '—'} → {summary.data.end ?? '—'}</dd>
        <dt className="text-muted-foreground">Total hours</dt><dd className="tabular-nums">{summary.data.hours.toFixed(2)}</dd>
        <dt className="text-muted-foreground">Locations</dt><dd>{summary.data.locations}</dd>
      </dl>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button variant="destructive" disabled={busy || !!stillOpen.length || !summary.data} onClick={() => void close()}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Close out project</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
