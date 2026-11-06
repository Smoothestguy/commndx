import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAddPersonnel } from '@/integrations/supabase/hooks/usePersonnel';
import { useAssignPersonnel } from '@/integrations/supabase/hooks/useLocationStaffing';
import { useVendors } from '@/integrations/supabase/hooks/useVendors';
import { useUserRole } from '@/hooks/useUserRole';
import { quickAddEmail } from '@/lib/personnelBilling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
export function QuickAddPerson({ locationId, role, onDone }: { locationId: string; role: string; onDone: (id: string, hasPhone: boolean) => void }) {
  const { isAdmin, isManager } = useUserRole();
  const [first, setFirst] = useState(''), [last, setLast] = useState(''), [phone, setPhone] = useState(''), [nb, setNb] = useState(false), [vendor, setVendor] = useState('');
  const [created, setCreated] = useState<string>(), [busy, setBusy] = useState(false);
  const add = useAddPersonnel(), assign = useAssignPersonnel(), qc = useQueryClient();
  const { data: vendors = [] } = useVendors();
  if (!isAdmin && !isManager) return null;
  return <div className="space-y-3 border-t pt-3">
    <div className="grid grid-cols-2 gap-2"><div><Label htmlFor="quick-first">First name</Label><Input id="quick-first" value={first} onChange={e => setFirst(e.target.value)} disabled={!!created || busy} /></div><div><Label htmlFor="quick-last">Last name</Label><Input id="quick-last" value={last} onChange={e => setLast(e.target.value)} disabled={!!created || busy} /></div></div>
    <div><Label htmlFor="quick-phone">Phone (optional)</Label><Input id="quick-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} disabled={!!created || busy} /></div>
    <div className="flex justify-between items-center"><Label htmlFor="quick-nb">Non-billable</Label><Switch id="quick-nb" checked={nb} onCheckedChange={setNb} disabled={!!created || busy} /></div>
    <Label>Agency / vendor (optional)</Label><Select value={vendor || 'none'} onValueChange={v => setVendor(v === 'none' ? '' : v)} disabled={!!created || busy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No agency / vendor</SelectItem>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
    {created && <p role="status" className="text-warning text-sm">Person saved. Retry the location assignment below.</p>}
    <Button disabled={busy || !first.trim() || !last.trim()} onClick={async () => { setBusy(true); try {
      let id = created;
      if (!id) { const person = await add.mutateAsync({ first_name: first.trim(), last_name: last.trim(), email: quickAddEmail(first, last, Date.now()), phone: phone.trim() || null, non_billable: nb, vendor_id: vendor || null, status: 'active', portal_required: false, personnel_number: '' }); id = person.id; setCreated(id); }
      await assign.mutateAsync({ location_id: locationId, personnel_ids: [id], role_label: role || null });
      await Promise.all([qc.invalidateQueries({ queryKey: ['personnel-lite-active'] }), qc.invalidateQueries({ queryKey: ['project-agencies'] })]);
      onDone(id, !!phone.trim());
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to add person'); } finally { setBusy(false); } }}>{busy ? 'Saving…' : created ? 'Retry assignment' : 'Create and assign'}</Button>
  </div>;
}