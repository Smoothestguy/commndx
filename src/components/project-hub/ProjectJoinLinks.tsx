import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useProjectVendors } from '@/integrations/supabase/hooks/useProjectVendors';
import { ProjectVendorPicker } from './ProjectVendorPicker';
import { projectVendorAllowed } from '@/lib/projectVendors';
import { useCustomers } from '@/integrations/supabase/hooks/useCustomers';
import { useProjectLocations } from '@/integrations/supabase/hooks/useProjectLocations';
import { RolePicker } from './LocationStaffing';
import { ROLE_TAGS } from '@/lib/roleTags';
import { customerNonBillableDefault, quickEmployer, type WorksFor } from '@/lib/personnelEmployer';
import { joinExpiry, publicJoinUrl } from '@/lib/projectJoin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Copy, Link2, Loader2, MessageSquare, MoreHorizontal, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerPortalLinks } from './CustomerPortalLinks';
import { useProject } from '@/integrations/supabase/hooks/useProjects';

export function ProjectJoinLinks({ projectId, locationId, iconOnly = false, menu = false }: { projectId: string; locationId?: string; iconOnly?: boolean; menu?: boolean }) {
  const { isAdmin, isManager } = useUserRole();
  const [open, setOpen] = useState(false);
  const [portalOpen,setPortalOpen]=useState(false);
  const {data:project}=useProject(projectId);
  if (!isAdmin && !isManager) return null;
  const trigger = <Button type="button" size={iconOnly ? 'icon' : 'sm'} variant="ghost" className={iconOnly ? 'h-9 w-9 shrink-0' : ''} aria-label="Join link" onClick={() => setOpen(true)}><Link2 className="h-4 w-4" />{!iconOnly && <span className="ml-1">Join link</span>}</Button>;
  return <>
    {menu ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Project actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setOpen(true)}><Link2 className="h-4 w-4 mr-2" />Join link</DropdownMenuItem><DropdownMenuItem disabled={!project?.customer_id} onSelect={()=>setPortalOpen(true)}><Link2 className="h-4 w-4 mr-2"/>Customer portal</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : iconOnly ? <Tooltip><TooltipTrigger asChild>{trigger}</TooltipTrigger><TooltipContent>Join link</TooltipContent></Tooltip> : trigger}
    <Dialog open={open} onOpenChange={setOpen}>{open && <JoinLinksDialog projectId={projectId} locationId={locationId} />}</Dialog>
    {portalOpen&&project?.customer_id&&<CustomerPortalLinks projectId={projectId} customerId={project.customer_id} open={portalOpen} onOpenChange={setPortalOpen}/>}
  </>;
}
function JoinLinksDialog({ projectId, locationId }: { projectId: string; locationId?: string }) {
  const { user } = useAuth();
  const { data: locations = [] } = useProjectLocations(projectId);
  const { data: vendors } = useProjectVendors(projectId);
  const { data: customers = [] } = useCustomers();
  const [scope, setScope] = useState(locationId || 'project'), [role, setRole] = useState('');
  const [worksFor, setWorksFor] = useState<WorksFor>('frg'), [vendor, setVendor] = useState(''), [customer, setCustomer] = useState('');
  const [nb, setNb] = useState(false), [days, setDays] = useState('30'), [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(''), [qr, setQr] = useState('');
  const links = useQuery({ queryKey: ['project-join-links', user?.id, projectId], refetchOnWindowFocus: true, queryFn: async () => {
    const { data, error } = await supabase.from('project_join_tokens').select('*, agency:vendors!project_join_tokens_vendor_id_fkey(name), employer:customers!project_join_tokens_employer_customer_id_fkey(name)').eq('project_id', projectId).eq('active', true).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
    if (error) throw error; return data;
  } });
  const url = selected ? publicJoinUrl(selected) : '';
  const selectedLink = links.data?.find(link => link.id === selected);
  const agencyName = selectedLink?.agency?.name?.trim();
  const shareText = agencyName ? `${agencyName} sign-up: ${url}` : url;
  useEffect(() => { let live = true; setQr(''); if (url) import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(url, { width: 320, margin: 2 })).then(value => { if (live) setQr(value); }).catch(() => { if (live) toast.error('Unable to create QR code'); }); return () => { live = false; }; }, [url]);
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); toast.success('Join link copied'); } catch { toast.error('Select and copy the link'); } };
  return <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Join links</DialogTitle></DialogHeader>
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault(); if (busy || !user) return; setBusy(true);
      try {
        if (scope !== 'project' && !locations.some(l => l.id === scope)) throw new Error('Select a project location');
        if (worksFor === 'agency' && !projectVendorAllowed(vendors, vendor)) throw new Error('Add this vendor to the project first');
        const { data, error } = await supabase.from('project_join_tokens').insert({ project_id: projectId, location_id: scope === 'project' ? null : scope, role_label: role.trim() || null, non_billable: nb, ...quickEmployer(worksFor, customer, vendor), expires_at: joinExpiry(Number(days)), created_by: user.id }).select('id').single();
        if (error) throw error; setSelected(data.id); await links.refetch(); toast.success('Join link created');
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to create join link'); } finally { setBusy(false); }
    }}>
      <div className="space-y-1"><Label htmlFor="join-scope">Scope</Label><Select value={scope} onValueChange={setScope} disabled={busy}><SelectTrigger id="join-scope"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="project">Whole project</SelectItem>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.id === locationId ? `This location — ${l.name}` : l.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Default role</Label><RolePicker value={role} onChange={setRole} options={[...ROLE_TAGS]} allowNone /></div>
      <div className="space-y-1"><Label htmlFor="join-works-for">Works for</Label><Select value={worksFor} disabled={busy} onValueChange={(v: WorksFor) => { setWorksFor(v); setCustomer(''); setVendor(''); setNb(current => customerNonBillableDefault(v, current)); }}><SelectTrigger id="join-works-for"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="frg">FRG</SelectItem><SelectItem value="agency">Agency…</SelectItem><SelectItem value="customer">Customer…</SelectItem></SelectContent></Select></div>
      {worksFor === 'agency' && <div className="space-y-1"><Label htmlFor="join-vendor">Agency / Vendor</Label><ProjectVendorPicker projectId={projectId} value={vendor} onChange={setVendor} id="join-vendor" disabled={busy}/></div>}
      {worksFor === 'customer' && <div className="space-y-1"><Label htmlFor="join-customer">Employer (customer)</Label><Select value={customer} onValueChange={setCustomer} disabled={busy}><SelectTrigger id="join-customer"><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>}
      <div className="flex items-center justify-between"><Label htmlFor="join-nb">Non-billable</Label><Switch id="join-nb" checked={nb} onCheckedChange={setNb} disabled={busy} /></div>
      <div className="space-y-1"><Label htmlFor="join-expiry">Expires in (days)</Label><Input id="join-expiry" type="number" min={1} step={1} value={days} onChange={e => setDays(e.target.value)} disabled={busy} required /></div>
      <Button type="submit" disabled={busy || (worksFor === 'agency' && !vendor) || (worksFor === 'customer' && !customer) || !Number.isInteger(Number(days)) || Number(days) < 1}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Create join link</Button>
    </form>
    {url && <section className="space-y-2 border-t pt-3"><Input aria-label="Join URL" readOnly value={url} onFocus={e => e.target.select()} /><div className="flex gap-2"><Button variant="outline" onClick={() => copy(shareText)}><Copy className="h-4 w-4 mr-1" />Copy link</Button><Button variant="outline" asChild><a href={`sms:?body=${encodeURIComponent(shareText)}`}><MessageSquare className="h-4 w-4 mr-1" />Text it</a></Button></div>{qr && <img src={qr} alt="Join link QR code" className="w-48 h-48 mx-auto" />}</section>}
    <section className="space-y-2 border-t pt-3"><h2 className="text-sm font-semibold">Active join links</h2>{links.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : links.error ? <div role="alert"><p className="text-sm text-destructive">Unable to load join links.</p><Button variant="ghost" onClick={() => links.refetch()}>Retry</Button></div> : !links.data?.length ? <p className="text-sm text-muted-foreground">No active join links.</p> : links.data.map(link => <div key={link.id} className="flex items-center gap-2 border-b py-2"><Button variant="ghost" className="flex-1 min-w-0 h-auto text-left justify-start whitespace-normal" onClick={() => setSelected(link.id)}><span className="min-w-0 break-words">{link.location_id ? locations.find(l => l.id === link.location_id)?.name || 'Location' : 'Whole project'}{link.role_label ? ` · ${link.role_label}` : ''}{link.vendor_id ? ` · ${link.agency?.name?.trim() || 'Agency / Vendor'}` : link.employer_customer_id ? ` · ${link.employer?.name?.trim() || 'Customer'}` : ''}{link.non_billable ? ' · Non-billable' : ''}<span className="block text-xs text-muted-foreground">Expires {new Date(link.expires_at).toLocaleDateString()}</span></span></Button><Button size="icon" variant="ghost" title="Revoke join link" aria-label="Revoke join link" disabled={busy} onClick={async () => { setBusy(true); try { const { error } = await supabase.from('project_join_tokens').update({ active: false }).eq('id', link.id).eq('project_id', projectId); if (error) throw error; if (selected === link.id) setSelected(''); await links.refetch(); toast.success('Join link revoked'); } catch { toast.error('Unable to revoke join link'); } finally { setBusy(false); } }}><X className="h-4 w-4 text-destructive" /></Button></div>)}</section>
  </DialogContent>;
}