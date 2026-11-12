import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProjectVendors, useSetProjectVendor } from '@/integrations/supabase/hooks/useProjectVendors';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

export function AddProjectVendor({ projectId, onAdded, disabled }: { projectId: string; onAdded?: (id: string) => void; disabled?: boolean }) {
  const { isAdmin, isManager } = useUserRole();
  const [open, setOpen] = useState(false), [search, setSearch] = useState('');
  const assigned = useProjectVendors(projectId);
  const save = useSetProjectVendor(projectId);
  const vendors = useQuery({ queryKey: ['project-vendor-directory', search.trim()], enabled: open && (isAdmin || isManager), queryFn: async () => {
    let request = supabase.from('vendors').select('id,name').is('deleted_at', null).order('name').limit(100);
    if (search.trim()) request = request.ilike('name', `%${search.trim().replace(/[%_]/g, '')}%`);
    const { data, error } = await request;
    if (error) throw error;
    return data;
  }});
  if (!isAdmin && !isManager) return null;
  return <><Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1"/>Add vendor to project</Button>
    <Dialog open={open} onOpenChange={value => { if (!save.isPending) setOpen(value); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Add vendor to project</DialogTitle></DialogHeader>
      <Input aria-label="Search vendors" placeholder="Search vendors…" value={search} onChange={e => setSearch(e.target.value)}/>
      <div className="max-h-80 overflow-y-auto space-y-1">{vendors.isLoading ? <p className="text-sm text-muted-foreground">Loading vendors…</p> : vendors.error ? <p role="alert" className="text-sm text-destructive">Unable to load vendors.</p> : vendors.data?.filter(v => !assigned.data.some(a => a.id === v.id)).map(v => <Button type="button" key={v.id} variant="ghost" className="w-full justify-between" disabled={save.isPending} onClick={async () => { try { await save.mutateAsync({ vendorId: v.id, active: true }); onAdded?.(v.id); setOpen(false); setSearch(''); toast.success('Vendor added to project'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to add vendor'); } }}><span className="truncate" title={v.name}>{v.name}</span><Plus className="h-4 w-4 shrink-0"/></Button>)}{vendors.data && !vendors.data.some(v => !assigned.data.some(a => a.id === v.id)) && <p className="text-sm text-muted-foreground">No matching vendors available.</p>}</div>
    </DialogContent></Dialog></>;
}

export function ProjectVendorPicker({ projectId, value, onChange, id, disabled, label = 'Agency / Vendor' }: { projectId: string; value: string; onChange: (value: string) => void; id?: string; disabled?: boolean; label?: string }) {
  const vendors = useProjectVendors(projectId);
  const selected = vendors.data.some(v => v.id === value) ? value : 'none';
  return <div className="space-y-1"><Select value={selected} onValueChange={v => onChange(v === 'none' ? '' : v)} disabled={disabled || vendors.isLoading || !!vendors.error}>
    <SelectTrigger id={id} aria-label={label}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">{vendors.data.length ? 'No vendor selected' : 'No vendors on this project yet'}</SelectItem>{vendors.data.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
  </Select>{vendors.error && <p role="alert" className="text-xs text-destructive">Unable to load project vendors.</p>}<AddProjectVendor projectId={projectId} onAdded={onChange} disabled={disabled}/></div>;
}

export function ProjectVendorsSection({ projectId }: { projectId: string }) {
  const vendors = useProjectVendors(projectId), save = useSetProjectVendor(projectId);
  const { isAdmin, isManager } = useUserRole();
  return <section className="space-y-2 border-b pb-4"><div className="flex items-center justify-between"><h2 className="text-base font-semibold">Vendors <span className="text-muted-foreground">({vendors.data.length})</span></h2><AddProjectVendor projectId={projectId}/></div>
    {vendors.isLoading ? <p className="text-sm text-muted-foreground">Loading vendors…</p> : vendors.error ? <p role="alert" className="text-sm text-destructive">Unable to load project vendors.</p> : !vendors.data.length ? <p className="text-sm text-muted-foreground">No vendors on this project yet</p> : <div className="flex flex-wrap gap-x-6 gap-y-2">{vendors.data.map(v => <div key={v.id} className="flex items-center gap-2 text-sm"><span>{v.name}</span>{(isAdmin || isManager) && <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title={`Remove ${v.name} from project`} aria-label={`Remove ${v.name} from project`} disabled={save.isPending} onClick={async () => { try { await save.mutateAsync({ vendorId: v.id, active: false }); toast.success('Vendor removed from project; history retained'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to remove vendor'); } }}><X className="h-4 w-4"/></Button>}</div>)}</div>}
  </section>;
}