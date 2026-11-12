import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { type Ownership, type RentalPeriod, validAssetCost } from '@/lib/assetDetails';
import { ProjectVendorPicker } from './ProjectVendorPicker';

export interface AssetOwnershipDraft {
  ownership: Ownership; vendor: string; unitCost: string; rentalRate: string; rentalPeriod: RentalPeriod; notes: string;
}
export const emptyOwnership: AssetOwnershipDraft = { ownership: 'owned', vendor: '', unitCost: '', rentalRate: '', rentalPeriod: 'day', notes: '' };

export function AssetOwnershipFields({ value, onChange, full = false, projectId }: {
  value: AssetOwnershipDraft; onChange: (v: AssetOwnershipDraft) => void; full?: boolean; projectId?: string;
}) {
  const vendors = useQuery({
    queryKey: ['asset-rental-vendors'],
    enabled: !projectId,
    queryFn: async () => {
      const { data, error } = await supabase.from('vendors').select('id,name').is('deleted_at', null).order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
  const costInput = (key: 'unitCost' | 'rentalRate', label: string) => <div className="space-y-1.5">
    <Label htmlFor={`asset-${key}`}>{label}</Label>
    <Input id={`asset-${key}`} type="number" min={0} step="0.01" inputMode="decimal" value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} />
    {!validAssetCost(value[key]) && <p className="text-xs text-destructive">Enter a nonnegative cost.</p>}
  </div>;
  return <div className="space-y-3">
    <div><Label>Ownership</Label><Select value={value.ownership} onValueChange={v => onChange({ ...value, ownership: v as Ownership, vendor: v === 'owned' ? '' : value.vendor })}>
      <SelectTrigger aria-label="Ownership"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="owned">Owned</SelectItem><SelectItem value="rented">Rented</SelectItem></SelectContent>
    </Select></div>
    {value.ownership === 'rented' && <div><Label>Rental vendor</Label>{projectId ? <ProjectVendorPicker projectId={projectId} value={value.vendor} onChange={vendor => onChange({...value,vendor})} label="Rental vendor"/> : <Select value={value.vendor || 'none'} onValueChange={v => onChange({ ...value, vendor: v === 'none' ? '' : v })}>
      <SelectTrigger aria-label="Rental vendor"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Select vendor</SelectItem>{vendors.data?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
    </Select>}{vendors.isError && <p className="text-xs text-destructive">Could not load vendors.</p>}</div>}
    {full && (value.ownership === 'owned' ? costInput('unitCost', 'Our cost — purchase ($)') : <div className="grid grid-cols-2 gap-3">
      {costInput('rentalRate', 'Our cost — rental ($)')}
      <div><Label>Rental period</Label><Select value={value.rentalPeriod} onValueChange={v => onChange({ ...value, rentalPeriod: v as RentalPeriod })}><SelectTrigger aria-label="Rental period"><SelectValue /></SelectTrigger><SelectContent>{(['day', 'week', 'month'] as const).map(p => <SelectItem key={p} value={p}>Per {p}</SelectItem>)}</SelectContent></Select></div>
    </div>)}
    {full && <div><Label htmlFor="asset-notes">Notes</Label><Textarea id="asset-notes" rows={2} value={value.notes} onChange={e => onChange({ ...value, notes: e.target.value })} /></div>}
  </div>;
}