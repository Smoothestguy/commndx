import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Switch} from '@/components/ui/switch';
import {Textarea} from '@/components/ui/textarea';
import type {ToTerms} from '@/lib/taskOrderEngine';
export function TaskOrderTermsEditor({value,onChange}:{value:ToTerms;onChange:(v:ToTerms)=>void}){
 const set=(v:Partial<ToTerms>)=>onChange({...value,...v});
 return <section className="border-t pt-3 space-y-3"><h3 className="text-sm font-semibold">Billing terms</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-2"><Label className="flex justify-between">Housing <Switch checked={value.housing_enabled} onCheckedChange={housing_enabled=>set({housing_enabled})}/></Label><Label htmlFor="to-housing">Allowance / person / day worked</Label><Input id="to-housing" type="number" min="0" step="0.01" disabled={!value.housing_enabled} value={value.housing_rate} onChange={e=>set({housing_rate:Number(e.target.value)})}/></div>
 <div className="space-y-2"><Label className="flex justify-between">Per diem <Switch checked={value.per_diem_enabled} onCheckedChange={per_diem_enabled=>set({per_diem_enabled})}/></Label><Label htmlFor="to-perdiem">Rate / person / day worked</Label><Input id="to-perdiem" type="number" min="0" step="0.01" disabled={!value.per_diem_enabled} value={value.per_diem_rate} onChange={e=>set({per_diem_rate:Number(e.target.value)})}/></div></div>
 <Label className="flex justify-between">Mobilization approved <Switch checked={value.mobe_approved} onCheckedChange={mobe_approved=>set({mobe_approved})}/></Label>
 <Label htmlFor="to-mobe-terms">Mobilization terms</Label><Textarea id="to-mobe-terms" value={value.mobe_terms??''} onChange={e=>set({mobe_terms:e.target.value||null})}/>
 <Label htmlFor="to-mobe-cap">Mobilization dollar cap / TO (optional)</Label><Input id="to-mobe-cap" type="number" min="0" step="0.01" value={value.mobe_cap??''} onChange={e=>set({mobe_cap:e.target.value===''?null:Number(e.target.value)})}/>
 </section>;
}