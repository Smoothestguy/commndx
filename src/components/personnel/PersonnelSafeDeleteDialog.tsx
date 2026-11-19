import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useDeletePersonnel, useHardDeletePersonnel } from '@/integrations/supabase/hooks/usePersonnel';
import { readPersonnelHistories } from '@/lib/personnelHistoryReader';
import { personnelDeleteBlocked, personnelHistorySummary } from '@/lib/personnelHistory';
import { toast } from 'sonner';
import { applicantDeleteOutcome } from '@/lib/applicantDeleteOutcome';

type Person = { id: string; first_name: string; last_name: string; personnel_number: string | null };
export function PersonnelSafeDeleteDialog({ people, onClose, onDone, onAllDeleted, onDeactivated }: { people: Person[]; onClose: () => void; onDone?: () => void; onAllDeleted?: () => Promise<void>; onDeactivated?: (person: Person) => void }) {
  const [finished, setFinished] = useState<Set<string>>(new Set());
  const remaining = people.filter(p => !finished.has(p.id));
  const ids = remaining.map(p => p.id).sort();
  const history = useQuery({ queryKey: ['personnel-delete-check', ids], queryFn: () => readPersonnelHistories(ids), staleTime: 0, gcTime: 0, retry: false });
  const del = useHardDeletePersonnel();
  const deactivate = useDeletePersonnel();
  const [busy, setBusy] = useState(false);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [deactivatedNames, setDeactivatedNames] = useState<string[]>([]);
  const clean = remaining.filter(p => { const h = history.data?.[p.id]; return h && !personnelDeleteBlocked(h); });
  const markDone = (id: string) => setFinished(prev => new Set([...prev,id]));
  const deleteClean = async () => {
    setBusy(true);
    try {
      // Refresh the batch, then the mutation rechecks each individual immediately before deletion.
      const fresh = await readPersonnelHistories(clean.map(p => p.id));
      const deleted = [...deletedIds];
      for (const p of clean) {
        if (personnelDeleteBlocked(fresh[p.id])) continue;
        try { await del.mutateAsync(p.id); markDone(p.id); deleted.push(p.id); } catch { /* Keep failures visible for retry. */ }
      }
      setDeletedIds(deleted);
      onDone?.();
      if (applicantDeleteOutcome(people.map(p => p.id), deleted, deactivatedNames) === 'delete') await onAllDeleted?.();
      else await history.refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not check personnel. Nothing was deleted.'); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl" onInteractOutside={e => { if (busy) e.preventDefault(); }}>
      <DialogHeader><DialogTitle>{remaining.length > 1 ? 'Check selected personnel before deleting' : remaining.length ? `Delete ${remaining[0].first_name} ${remaining[0].last_name} ${remaining[0].personnel_number ?? ''}?` : 'Check complete'}</DialogTitle></DialogHeader>
      {history.isPending ? <p role="status">Checking hours, documents and assignments…</p> : history.isError ? <p role="alert" className="text-destructive">{history.error.message}</p> : <ul className="space-y-4">
        {remaining.map(p => { const h = history.data[p.id]; const blocked = personnelDeleteBlocked(h); return <li key={p.id} className="space-y-2 border-b border-border pb-3">
          <p className="font-medium">{p.first_name} {p.last_name} {p.personnel_number}</p>
          <p className="text-sm text-muted-foreground">{blocked ? `${p.first_name} ${p.last_name} ${p.personnel_number ?? ''} has: ${personnelHistorySummary(h)}. Deleting would erase these.` : 'No hours, documents or assignments.'}</p>
          {!blocked && <p className="text-xs text-muted-foreground">{personnelHistorySummary(h)}</p>}
          {blocked && <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await deactivate.mutateAsync(p.id); markDone(p.id); setDeactivatedNames(prev => [...prev, `${p.first_name} ${p.last_name}`]); onDone?.(); onDeactivated?.(p); } catch { /* Hook reports failure. */ } finally { setBusy(false); } }}>Deactivate instead</Button>}
        </li>; })}
      </ul>}
      <DialogFooter className="gap-2">
        <Button variant="outline" disabled={busy} onClick={onClose}>{remaining.length ? 'Cancel' : 'Close'}</Button>
        {history.isError && <Button variant="outline" onClick={() => history.refetch()}>Retry check</Button>}
        {!remaining.length && onAllDeleted && !deactivatedNames.length && <Button disabled={busy} onClick={async () => { setBusy(true); try { await onAllDeleted(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not finish applicant deletion'); } finally { setBusy(false); } }}>Finish applicant deletion</Button>}
        {clean.length > 0 && !history.isError && <Button variant="destructive" disabled={busy || history.isFetching} onClick={deleteClean}>{busy ? 'Deleting…' : people.length === 1 ? 'Delete' : `Delete ${clean.length} clean record${clean.length === 1 ? '' : 's'}`}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}