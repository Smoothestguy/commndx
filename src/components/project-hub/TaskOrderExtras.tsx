import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, Trash2 } from 'lucide-react';
import { detailEntries, type DetailRow } from '@/lib/taskOrderExtras';
export function TaskOrderExtrasEditor({travelTime,setTravelTime,rows,setRows,portal=false}:{travelTime:boolean|null;setTravelTime:(v:boolean|null)=>void;rows:DetailRow[];setRows:(v:DetailRow[])=>void;portal?:boolean}) {
  return <section className="space-y-3 border-t pt-3"><div className="flex flex-wrap items-center gap-3"><Label>Travel time included?</Label><ToggleGroup type="single" variant="outline" value={travelTime===null?'':travelTime?'yes':'no'} onValueChange={v=>setTravelTime(v==='yes'?true:v==='no'?false:null)} aria-label="Travel time included"><ToggleGroupItem value="yes">Yes</ToggleGroupItem><ToggleGroupItem value="no">No</ToggleGroupItem></ToggleGroup></div><h3 className="text-sm font-medium">Additional info</h3>{rows.map((row,i)=><div className="grid grid-cols-[1fr_1fr_2.5rem] gap-2" key={row.id}><Input aria-label={`Additional info label ${i+1}`} placeholder="Label" maxLength={80} value={row.label} onChange={e=>setRows(rows.map(r=>r.id===row.id?{...r,label:e.target.value}:r))}/><Input aria-label={`Additional info value ${i+1}`} placeholder="Value" maxLength={500} value={row.value} onChange={e=>setRows(rows.map(r=>r.id===row.id?{...r,value:e.target.value}:r))}/><Button type="button" variant="ghost" size="icon" aria-label={`Remove additional info ${i+1}`} onClick={()=>setRows(rows.filter(r=>r.id!==row.id))}><Trash2 className="h-4 w-4"/></Button></div>)}<Button type="button" size="sm" variant="outline" disabled={rows.length>=20} onClick={()=>setRows([...rows,{id:crypto.randomUUID(),label:'',value:''}])}><Plus className="h-4 w-4 mr-1"/>Add info</Button></section>;
}
export function TaskOrderExtrasDisplay({travelTime,details}:{travelTime?:boolean|null;details?:unknown}) {
  const entries=detailEntries(details);
  if(travelTime==null&&!entries.length)return null;
  return <div className="text-sm space-y-1 break-words">{travelTime!=null&&<p>Travel time included: {travelTime?'Yes':'No'}</p>}{entries.map(([label,value])=><p key={label}><span className="font-medium">{label}:</span> {value}</p>)}</div>;
}