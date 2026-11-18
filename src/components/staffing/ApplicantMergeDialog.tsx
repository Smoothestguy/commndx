import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useApplicantDuplicates } from '@/hooks/useApplicantDuplicates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { canMergeApplicants } from '@/lib/recruiting';
export interface MergeCandidate { id: string; first_name: string; last_name: string; email?: string | null; phone?: string | null }
export function ApplicantMergeDialog({ candidates, onClose, onMerged }: { candidates: MergeCandidate[] | null; onClose: () => void; onMerged?: () => void }) {
  const [keep, setKeep] = useState(''); const [busy, setBusy] = useState(false);
  const { isAdmin, isManager } = useUserRole(); const qc = useQueryClient();
  useEffect(() => { setKeep(candidates?.[0]?.id ?? ''); }, [candidates]);
  const allowed = canMergeApplicants(isAdmin || isManager, (candidates ?? []).map(r => r.id));
  return <Dialog open={!!candidates} onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent onInteractOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>Merge applicants</DialogTitle><DialogDescription>Choose the survivor. Applications and related records stay intact; the other profile is archived. Verify identity before merging.</DialogDescription></DialogHeader><RadioGroup value={keep} onValueChange={setKeep} disabled={busy}>{candidates?.map(r => <label key={r.id} className="flex items-start gap-3 border border-border rounded-md p-3"><RadioGroupItem value={r.id} aria-label={`Keep ${r.first_name} ${r.last_name} ${r.email ?? ''}`} /><span className="min-w-0 break-words"><span className="block font-medium">{r.first_name} {r.last_name}</span><span className="block text-sm text-muted-foreground">{r.email} · {r.phone}</span></span></label>)}</RadioGroup><DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={!allowed || !keep || busy} onClick={async () => {
    const source = candidates?.find(r => r.id !== keep); if (!source || !allowed) return;
    setBusy(true); try {
      const { data, error } = await supabase.rpc('merge_applicants', { _keep_id: keep, _merge_id: source.id });
      if (error) throw error;
      const result = data as { success?: boolean; applications_moved?: number };
      if (!result.success) throw new Error('Merge was not completed');
      await Promise.all(['applicants','master-applicants','applications','duplicate-applicant-groups','applicant-cert-summary','applicant-capabilities'].map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success('Applicants merged; duplicate archived'); onMerged?.(); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Merge failed'); } finally { setBusy(false); }
  }}>{busy ? 'Merging…' : 'Confirm merge'}</Button></DialogFooter></DialogContent></Dialog>;
}
export function ApplicantDuplicateActions({ applicant, onMerged }: { applicant: MergeCandidate; onMerged?: () => void }) {
  const { groupsFor } = useApplicantDuplicates(); const { isAdmin, isManager } = useUserRole();
  const [pair, setPair] = useState<MergeCandidate[] | null>(null);
  const groups = groupsFor(applicant.id);
  const others = new Map<string, MergeCandidate>();
  for (const g of groups) g.applicant_ids.forEach((id,i) => { if (id !== applicant.id) others.set(id, { id, first_name: g.names[i], last_name: '', email: g.emails[i], phone: g.phones[i] }); });
  if (!groups.length) return null;
  return <div className="flex flex-wrap gap-2 items-center"><Badge variant="outline">Possible duplicate</Badge>{(isAdmin || isManager) && <Select value="" onValueChange={id => { const other = others.get(id); if (other) setPair([applicant,other]); }}><SelectTrigger aria-label="Merge applicant" className="w-44"><SelectValue placeholder="Merge with…" /></SelectTrigger><SelectContent>{[...others.values()].map(r => <SelectItem key={r.id} value={r.id}>{r.first_name} · {r.email}</SelectItem>)}</SelectContent></Select>}<ApplicantMergeDialog candidates={pair} onClose={() => setPair(null)} onMerged={onMerged} /></div>;
}