import { EnhancedDataTable, type EnhancedColumn } from '@/components/shared/EnhancedDataTable';
import { PersonnelBulkActions } from './PersonnelBulkActions';
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
  const columns: EnhancedColumn<P>[] = [
    { key: 'name', header: 'Name', width: 240, getValue: p => `${p.first_name} ${p.last_name}`, render: p => <span><BenchStar on /><Link to={`/personnel/${p.id}`} className="hover:underline">{p.first_name} {p.last_name}</Link></span> },
    { key: 'bench_rank', header: 'Rank', render: p => canEdit ? <Input type="number" min={1} defaultValue={p.bench_rank ?? ''} aria-label="Bench rank" className="h-7 w-16" onBlur={e => { const n = Number(e.target.value); const v = e.target.value && Number.isFinite(n) ? Math.max(1, Math.floor(n)) : null; if (v !== (p.bench_rank ?? null)) upd.mutate({ ids: [p.id], patch: { bench_rank: v } }); }} /> : p.bench_rank ?? '—' },
    { key: 'available', header: 'Availability', getValue: p => p.status !== 'active' ? p.status ?? '' : active[p.id] ? `On ${active[p.id]}` : 'Available' },
    { key: 'phone', header: 'Phone' },
    { key: 'tags', header: 'Tags', getValue: p => tagsByPerson?.[p.id]?.join(', ') ?? '', render: p => <TagChips tags={tagsByPerson?.[p.id]} /> },
    { key: 'last', header: 'Last project', getValue: p => last[p.id] ?? '' },
    { key: 'bench_note', header: 'Note', width: 240, render: p => canEdit ? <Input defaultValue={p.bench_note ?? ''} aria-label="Bench note" className="h-7" onBlur={e => { const v = e.target.value.trim() || null; if (v !== (p.bench_note ?? null)) upd.mutate({ ids: [p.id], patch: { bench_note: v } }); }} /> : p.bench_note },
    { key: 'actions', header: 'Actions', sortable: false, filterable: false, noExport: true, render: p => canEdit && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remove from bench" onClick={() => upd.mutate({ ids: [p.id], patch: { on_bench: false, bench_rank: null } }, { onSuccess: () => force(x => x + 1) })}><StarOff className="h-3.5 w-3.5" /></Button> },
  ];
  return <EnhancedDataTable tableId="personnel-bench" data={rows} columns={columns} selectedIds={selected}
    onSelectionChange={next => { for (const p of rows) if (next.has(p.id) !== selected.has(p.id)) onToggle(p.id); }}
    exportName="bench" defaultSortKey="bench_rank" defaultSortDirection="asc" attention={p => !p.phone ? 'Missing phone' : null}
    bulkActions={canEdit ? (people, clear) => <PersonnelBulkActions people={people} worksFor={() => 'FRG'} tagsByPerson={tagsByPerson} onDone={clear} /> : undefined} />;
}
