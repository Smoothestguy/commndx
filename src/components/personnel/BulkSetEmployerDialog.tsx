import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCustomers } from '@/integrations/supabase/hooks/useCustomers';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { employerPatch, FRG } from '@/lib/bulkEmployer';

export function BulkSetEmployerDialog({ open, onOpenChange, personnelIds, locationId, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; personnelIds: string[]; locationId?: string; onDone?: () => void;
}) {
  const qc = useQueryClient();
  const { data: customers = [] } = useCustomers();
  const [choice, setChoice] = useState('');
  const [retag, setRetag] = useState(false);
  const cust = customers.find(c => c.id === choice);
  const label = choice === FRG ? 'FRG (billable)' : (cust?.company || cust?.name || 'customer');
  const n = personnelIds.length;
  const save = useMutation({
    mutationFn: async () => {
      const patch = employerPatch(choice);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: before } = await supabase.from('personnel').select('id, employer_customer_id, non_billable, vendor_id').in('id', personnelIds);
      const { error } = await supabase.from('personnel').update(patch).in('id', personnelIds);
      if (error) throw error;
      let retagged = 0, skipped = 0;
      if (retag && locationId) {
        const { data: rows, error: re } = await supabase.from('time_entries').select('id, invoice_id, week_closeout_id').is('voided_at', null).eq('location_id', locationId).in('personnel_id', personnelIds);
        if (re) throw re;
        const ok = (rows || []).filter(r => !r.invoice_id && !r.week_closeout_id).map(r => r.id);
        skipped = (rows || []).length - ok.length;
        for (let i = 0; i < ok.length; i += 200) {
          const { error: ue } = await supabase.from('time_entries').update({ billable: !patch.non_billable }).in('id', ok.slice(i, i + 200));
          if (ue) throw ue;
        }
        retagged = ok.length;
      }
      if (user) {
        const { error: ae } = await supabase.from('audit_logs').insert((before || []).map(b => ({
          user_id: user.id, user_email: user.email || 'unknown', action_type: 'bulk_set_employer', resource_type: 'personnel', resource_id: b.id,
          changes_before: { employer_customer_id: b.employer_customer_id, non_billable: b.non_billable, vendor_id: b.vendor_id }, changes_after: patch,
          metadata: { note: `Employer set to ${label}`, location_id: locationId ?? null, time_entries_retagged: retag ? retagged : 0 }, success: true,
        })));
        if (ae) toast.warning('Employer saved, but the audit note failed to record');
      }
      return { retagged, skipped };
    },
    onSuccess: ({ retagged, skipped }) => {
      qc.invalidateQueries();
      toast.success(`${n} updated to ${label}${retag ? ` · ${retagged} time entries re-marked${skipped ? `, ${skipped} invoiced/closed left unchanged` : ''}` : ''}`);
      onOpenChange(false); setChoice(''); setRetag(false); onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const effect = !choice ? '' : choice === FRG
    ? `${n} ${n === 1 ? 'person becomes' : 'people become'} FRG employees — billable on invoices.`
    : `${n} ${n === 1 ? 'person becomes a' : 'people become'} ${label} ${n === 1 ? 'employee' : 'employees'} — tracked on timesheets, excluded from invoices.`;
  return (
    <Dialog open={open} onOpenChange={o => !save.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Set employer</DialogTitle><DialogDescription>{n} selected</DialogDescription></DialogHeader>
        <Select value={choice} onValueChange={setChoice}>
          <SelectTrigger><SelectValue placeholder="Choose employer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={FRG}>FRG (billable)</SelectItem>
            {[...customers].sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name)).map(c => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {effect && <p className="text-sm text-muted-foreground">{effect}</p>}
        {locationId && choice && (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={retag} onCheckedChange={v => setRetag(v === true)} className="mt-0.5" />
            <span>Also re-mark their existing time entries on this location as {choice === FRG ? 'billable' : 'non-billable'} <span className="text-muted-foreground">(invoiced or closed weeks are left unchanged)</span></span>
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!choice || save.isPending}>{save.isPending ? 'Saving…' : 'Confirm'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
