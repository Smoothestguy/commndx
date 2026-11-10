import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAssignPersonnel } from '@/integrations/supabase/hooks/useLocationStaffing';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Loc = { id: string; name: string; status: string | null; projects: { name: string | null } | null };

/** Assign selected people to an open project location (uses the normal audited assignment saver). */
export function BulkAssignLocationDialog({ open, onOpenChange, personnelIds, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; personnelIds: string[]; onDone?: () => void }) {
  const [q, setQ] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const assign = useAssignPersonnel();
  const { data = [], isLoading } = useQuery({
    queryKey: ['bulk-assign-locations'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from('project_locations').select('id,name,status,projects(name)').neq('status', 'closed').order('name');
      if (error) throw error;
      return (data ?? []) as unknown as Loc[];
    },
  });
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.filter(l => !t || `${l.name} ${l.projects?.name ?? ''}`.toLowerCase().includes(t));
  }, [data, q]);

  const save = () => {
    if (!locationId) return;
    assign.mutate({ location_id: locationId, personnel_ids: personnelIds, role_label: role.trim() || null }, {
      onSuccess: () => { onOpenChange(false); setLocationId(null); setRole(''); onDone?.(); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign {personnelIds.length} to a location</DialogTitle>
          <DialogDescription>Already-assigned people are skipped. Closed locations are not listed.</DialogDescription>
        </DialogHeader>
        <Input autoFocus placeholder="Search locations or projects…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search locations" />
        <div className="max-h-64 overflow-auto border border-border rounded-md divide-y divide-border" role="listbox" aria-label="Locations">
          {isLoading && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && list.length === 0 && <p className="p-3 text-sm text-muted-foreground">No open locations match.</p>}
          {list.map(l => (
            <button key={l.id} type="button" role="option" aria-selected={locationId === l.id} onClick={() => setLocationId(l.id)}
              className={cn('w-full text-left px-3 py-1.5 text-sm hover:bg-muted', locationId === l.id && 'bg-accent font-medium')}>
              {l.name}<span className="block text-xs text-muted-foreground">{l.projects?.name ?? ''}</span>
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <Label htmlFor="bulk-role">Role (optional)</Label>
          <Input id="bulk-role" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Operator" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!locationId || assign.isPending} onClick={save}>{assign.isPending ? 'Assigning…' : 'Assign'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
