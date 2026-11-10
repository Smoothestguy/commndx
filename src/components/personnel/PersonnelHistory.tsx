import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { mergeEngagements } from '@/lib/personnelSegment';

const day = (s: string | null) => s ? new Date(s).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : null;

/** Auto-derived engagement history: project/location, role, dates, total hours (time_entries) + manager note. */
export function PersonnelHistory({ personnelId, canEdit }: { personnelId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['personnel-history', personnelId],
    queryFn: async () => {
      const [la, ppa, notes] = await Promise.all([
        supabase.from('location_assignments').select('location_id, role_label, assigned_at, unassigned_at, project_locations:location_id(name, project_id, projects:project_id(name))').eq('personnel_id', personnelId),
        supabase.from('personnel_project_assignments').select('project_id, assigned_at, unassigned_at, work_classification, projects:project_id(name)').eq('personnel_id', personnelId),
        supabase.from('personnel_engagement_notes').select('id, project_id, location_id, note').eq('personnel_id', personnelId),
      ]);
      if (la.error) throw la.error; if (ppa.error) throw ppa.error;
      const hours: Record<string, number> = {};
      for (let from = 0; ; from += 1000) {
        const { data: te, error } = await supabase.from('time_entries').select('project_id, location_id, hours').eq('personnel_id', personnelId).range(from, from + 999);
        if (error) throw error;
        for (const t of te ?? []) {
          const h = Number(t.hours) || 0;
          hours[`${t.project_id}:${t.location_id ?? ''}`] = (hours[`${t.project_id}:${t.location_id ?? ''}`] ?? 0) + h;
          hours[`${t.project_id}:*`] = (hours[`${t.project_id}:*`] ?? 0) + h;
        }
        if ((te ?? []).length < 1000) break;
      }
      const names: Record<string, string> = {}; const locNames: Record<string, string> = {};
      const rows = [
        ...(la.data ?? []).filter((r: any) => r.project_locations).map((r: any) => {
          names[r.project_locations.project_id] = r.project_locations.projects?.name ?? 'Project'; locNames[r.location_id] = r.project_locations.name;
          return { project_id: r.project_locations.project_id, location_id: r.location_id, role: r.role_label, start: r.assigned_at, end: r.unassigned_at };
        }),
        ...(ppa.data ?? []).map((r: any) => { names[r.project_id] = r.projects?.name ?? 'Project'; return { project_id: r.project_id, location_id: null, role: r.work_classification, start: r.assigned_at, end: r.unassigned_at }; }),
      ];
      return { engagements: mergeEngagements(rows), hours, names, locNames, notes: notes.data ?? [] };
    },
  });
  const saveNote = useMutation({
    mutationFn: async ({ project_id, location_id, note, id }: { project_id: string; location_id: string | null; note: string; id?: string }) => {
      const { error } = id
        ? await supabase.from('personnel_engagement_notes').update({ note, updated_at: new Date().toISOString() }).eq('id', id)
        : await supabase.from('personnel_engagement_notes').insert({ personnel_id: personnelId, project_id, location_id, note });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personnel-history', personnelId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const noteFor = useMemo(() => {
    const m: Record<string, { id: string; note: string }> = {};
    for (const n of data?.notes ?? []) m[`${n.project_id}:${n.location_id ?? ''}`] = n;
    return m;
  }, [data]);

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (!data?.engagements.length) return <p className="text-sm text-muted-foreground">No past projects yet.</p>;
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader><TableRow className="bg-muted/50">
          <TableHead>Project</TableHead><TableHead>Location</TableHead><TableHead>Role</TableHead><TableHead>Dates</TableHead><TableHead className="text-right">Hours</TableHead><TableHead>Note</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {data.engagements.map(e => {
            const k = `${e.project_id}:${e.location_id ?? ''}`;
            const h = data.hours[e.location_id ? k : `${e.project_id}:*`] ?? 0;
            const n = noteFor[k];
            return (
              <TableRow key={k}>
                <TableCell className="font-medium"><Link to={`/projects/${e.project_id}`} className="hover:underline hover:text-primary">{data.names[e.project_id]}</Link></TableCell>
                <TableCell>{e.location_id ? data.locNames[e.location_id] : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{e.roles.join(', ') || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{day(e.start)} – {e.end ? day(e.end) : 'present'}</TableCell>
                <TableCell className="text-right tabular-nums">{h.toFixed(2)}</TableCell>
                <TableCell className="min-w-[12rem]">{canEdit
                  ? <Input key={n?.id ?? k} defaultValue={n?.note ?? ''} placeholder="Add note" aria-label="Engagement note" className="h-8"
                      onBlur={ev => { const v = ev.target.value.trim(); if (v !== (n?.note ?? '')) saveNote.mutate({ project_id: e.project_id, location_id: e.location_id, note: v, id: n?.id }); }} />
                  : <span className="text-sm">{n?.note}</span>}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
