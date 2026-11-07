import { Link } from 'react-router-dom';
import { useAssetAssignmentsByPersonnel } from '@/integrations/supabase/hooks/useAssetAssignments';
import { ownershipText } from '@/lib/assetDetails';
import { Badge } from '@/components/ui/badge';

export function PersonnelAssetCare({ personnelId }: { personnelId: string }) {
  const q = useAssetAssignmentsByPersonnel(personnelId);
  const rows = (q.data ?? []).filter(a => a.status === 'active' && !a.unassigned_at && (!a.end_at || Date.parse(a.end_at) > Date.now()));
  return <section className="space-y-3"><h3 className="font-semibold">Assets in their care</h3>
    {q.isError ? <p className="text-destructive">Could not load assets.</p> : q.isLoading ? <p className="text-muted-foreground">Loading…</p> : !rows.length ? <p className="text-muted-foreground">No assets currently in their care.</p> : <ul className="divide-y">{rows.map(r => <li key={r.id} className="py-3 flex flex-wrap gap-2 items-center">
      <span className="font-medium">{r.assets?.label ?? 'Asset'}</span><Badge variant="outline">{ownershipText(r.assets)}</Badge>
      <Link className="text-primary hover:underline" to={r.location_id ? `/projects/${r.project_id}/locations/${r.location_id}` : `/projects/${r.project_id}`}>{r.projects?.name ?? 'Project'}</Link>
    </li>)}</ul>}
  </section>;
}