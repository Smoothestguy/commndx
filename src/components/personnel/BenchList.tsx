import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StarOff } from 'lucide-react';
import { useActiveProjectAssignmentMap } from '@/integrations/supabase/hooks/useLocationStaffing';
import { useBulkPersonnelUpdate } from '@/hooks/usePersonnelTags';
import { benchCompare } from '@/lib/personnelSegment';
import { BenchStar, TagChips } from './PersonnelTags';
import type { BulkPerson } from './PersonnelBulkActions';

type P = BulkPerson & { bench_rank?: number | null; bench_note?: string | null };

function useLastProjects(ids: string[]) {
  return useQuery({
    queryKey: ['bench-last-projects', [...ids].sort()],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel_project_assignments')
        .select('personnel_id, assigned_at, projects:project_id(name)').in('personnel_id', ids).order('assigned_at', { ascending: false });
      if (error) throw error;
      const m: Record<string, string> = {};
      for (const r of data ?? []) { const n = (r as any).projects?.name; if (n && !m[r.personnel_id]) m[r.personnel_id] = n; }
      return m;
    },
  });
}

export function BenchList({ people, tagsByPerson, selected, onToggle, onToggleAll, canEdit }: {
  people: P[]; tagsByPerson?: Record<string, string[]>; selected: Set<string>; onToggle: (id: string) => void; onToggleAll: (ids: string[]) => void; canEdit: boolean;
}) {
  const rows = useMemo(() => [...people].sort(benchCompare), [people]);
  const { data: active = {} } = useActiveProjectAssignmentMap(rows.length > 0);
  const { data: last = {} } = useLastProjects(rows.map(r => r.id));
  const upd = useBulkPersonnelUpdate();
  const [, force] = useState(0);
  if (!rows.length) return <p className="text-sm text-muted-foreground py-8 text-center">Nobody on the bench yet. Select people and choose “Add to bench”.</p>;
  const allOn = rows.every(r => selected.has(r.id));
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-8"><Checkbox aria-label="Select all bench" checked={allOn} onCheckedChange={() => onToggleAll(rows.map(r => r.id))} /></TableHead>
            <TableHead className="w-16">Rank</TableHead><TableHead>Name</TableHead><TableHead>Availability</TableHead>
            <TableHead>Phone</TableHead><TableHead>Tags</TableHead><TableHead>Last project</TableHead><TableHead>Note</TableHead><TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(p => (
            <TableRow key={p.id} data-state={selected.has(p.id) ? 'selected' : undefined}>
              <TableCell><Checkbox aria-label={`Select ${p.first_name} ${p.last_name}`} checked={selected.has(p.id)} onCheckedChange={() => onToggle(p.id)} /></TableCell>
              <TableCell>
                {canEdit ? <Input type="number" min={1} defaultValue={p.bench_rank ?? ''} aria-label="Bench rank" className="h-8 w-14"
                  onBlur={e => { const v = e.target.value ? Math.max(1, parseInt(e.target.value)) : null; if (v !== (p.bench_rank ?? null)) upd.mutate({ ids: [p.id], patch: { bench_rank: v } }); }} />
                  : p.bench_rank ?? '—'}
              </TableCell>
              <TableCell className="font-medium whitespace-nowrap"><BenchStar on /> <Link to={`/personnel/${p.id}`} className="hover:underline hover:text-primary">{p.first_name} {p.last_name}</Link></TableCell>
              <TableCell>{p.status !== 'active' ? <Badge variant="secondary">{p.status === 'do_not_hire' ? 'DNH' : 'Inactive'}</Badge>
                : active[p.id] ? <Badge variant="outline" className="font-normal">On {active[p.id]}</Badge> : <Badge className="font-normal">Available</Badge>}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">{p.phone ? <a href={`tel:${p.phone}`} className="hover:underline">{p.phone}</a> : <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell><TagChips tags={tagsByPerson?.[p.id]} /></TableCell>
              <TableCell className="text-sm">{last[p.id] ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="min-w-[10rem]">
                {canEdit ? <Input defaultValue={p.bench_note ?? ''} placeholder="Note" aria-label="Bench note" className="h-8"
                  onBlur={e => { const v = e.target.value.trim() || null; if (v !== (p.bench_note ?? null)) upd.mutate({ ids: [p.id], patch: { bench_note: v } }); }} />
                  : <span className="text-sm">{p.bench_note}</span>}
              </TableCell>
              <TableCell>{canEdit && <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Remove from bench"
                onClick={() => upd.mutate({ ids: [p.id], patch: { on_bench: false, bench_rank: null } }, { onSuccess: () => force(x => x + 1) })}><StarOff className="h-4 w-4" /></Button>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
