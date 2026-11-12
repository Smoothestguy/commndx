import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAddPersonnel } from '@/integrations/supabase/hooks/usePersonnel';
import { useAssignPersonnel } from '@/integrations/supabase/hooks/useLocationStaffing';
import { useLocationProjectId, useProjectVendors } from '@/integrations/supabase/hooks/useProjectVendors';
import { ProjectVendorPicker } from './ProjectVendorPicker';
import { projectVendorAllowed } from '@/lib/projectVendors';
import { useCustomers } from '@/integrations/supabase/hooks/useCustomers';
import { quickEmployer, customerNonBillableDefault, type WorksFor } from '@/lib/personnelEmployer';
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
  const [worksFor, setWorksFor] = useState<WorksFor>('frg'), [customer, setCustomer] = useState('');
  const [created, setCreated] = useState<string>(), [busy, setBusy] = useState(false);
  const add = useAddPersonnel(), assign = useAssignPersonnel(), qc = useQueryClient();
  const { data: projectId } = useLocationProjectId(locationId);
  const { data: vendors } = useProjectVendors(projectId);
  const { data: customers = [] } = useCustomers();
  if (!isAdmin && !isManager) return null;
  return <div className="space-y-3 border-t pt-3">
    <div className="grid grid-cols-2 gap-2"><div><Label htmlFor="quick-first">First name</Label><Input id="quick-first" value={first} onChange={e => setFirst(e.target.value)} disabled={!!created || busy} /></div><div><Label htmlFor="quick-last">Last name</Label><Input id="quick-last" value={last} onChange={e => setLast(e.target.value)} disabled={!!created || busy} /></div></div>
    <div><Label htmlFor="quick-phone">Phone (optional)</Label><Input id="quick-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} disabled={!!created || busy} /></div>
    <div className="flex justify-between items-center"><Label htmlFor="quick-nb">Non-billable</Label><Switch id="quick-nb" checked={nb} onCheckedChange={setNb} disabled={!!created || busy} /></div>
    <div><Label htmlFor="quick-works-for">Works for</Label><Select value={worksFor} onValueChange={(v: WorksFor) => { setWorksFor(v); setVendor(''); setCustomer(''); setNb(current => customerNonBillableDefault(v, current)); }} disabled={!!created || busy}><SelectTrigger id="quick-works-for"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="frg">FRG</SelectItem><SelectItem value="agency">Agency…</SelectItem><SelectItem value="customer">Customer…</SelectItem></SelectContent></Select></div>
    {worksFor === 'agency' && <div><Label htmlFor="quick-vendor">Agency / Vendor</Label>{projectId && <ProjectVendorPicker projectId={projectId} value={vendor} onChange={setVendor} id="quick-vendor" disabled={!!created || busy}/>}</div>}
    {worksFor === 'customer' && <div><Label htmlFor="quick-customer">Employer (customer)</Label><Select value={customer || 'none'} onValueChange={v => setCustomer(v === 'none' ? '' : v)} disabled={!!created || busy}><SelectTrigger id="quick-customer"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Select customer</SelectItem>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>}
    {created && <p role="status" className="text-warning text-sm">Person saved. Retry the location assignment below.</p>}
    <Button disabled={busy || !first.trim() || !last.trim() || (worksFor === 'agency' && !vendor) || (worksFor === 'customer' && !customer)} onClick={async () => { setBusy(true); try {
      if (worksFor === 'agency' && !projectVendorAllowed(vendors, vendor)) throw new Error('Add this vendor to the project first');
      let id = created;
      if (!id) { const person = await add.mutateAsync({ first_name: first.trim(), last_name: last.trim(), email: quickAddEmail(first, last, Date.now()), phone: phone.trim() || null, non_billable: nb, ...quickEmployer(worksFor, customer, vendor), status: 'active', portal_required: false, personnel_number: '' }); id = person.id; setCreated(id); }
      await assign.mutateAsync({ location_id: locationId, personnel_ids: [id], role_label: role || null });
      await Promise.all([qc.invalidateQueries({ queryKey: ['personnel-lite-active'] }), qc.invalidateQueries({ queryKey: ['project-agencies'] }),qc.invalidateQueries({queryKey:['project-personnel-roster']})]);
      onDone(id, !!phone.trim());
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to add person'); } finally { setBusy(false); } }}>{busy ? 'Saving…' : created ? 'Retry assignment' : 'Create and assign'}</Button>
  </div>;
}