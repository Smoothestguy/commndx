import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useLogManualTime} from '@/integrations/supabase/hooks/useFieldMode';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Checkbox} from '@/components/ui/checkbox';
import {Time24Input} from '@/components/ui/time24-input';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {locationTimeIso} from '@/lib/manualTime';
import {midnight,nextDay} from '@/lib/signinSheets';
import {roleAt} from '@/lib/assignmentRoles';
import {toast} from 'sonner';
export type DemobeOrder={id:string;number:string;day:string;travelTime:boolean|null;roles:string[]};
export function DemobeTimeDialog({order,projectId,locationId,timezone,onClose}:{order:DemobeOrder;projectId:string;locationId:string;timezone?:string|null;onClose:()=>void}){
 const tz=timezone||'America/Chicago',log=useLogManualTime(projectId);
 const [day,setDay]=useState(order.day),[mode,setMode]=useState('hours'),[hours,setHours]=useState(''),[timeIn,setTimeIn]=useState(''),[timeOut,setTimeOut]=useState(''),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[done,setDone]=useState<string[]>([]);
 const people=useQuery({queryKey:['demobe-roster',locationId,day,order.id],queryFn:async()=>{
   const start=new Date(midnight(day,tz)).toISOString(),end=new Date(midnight(nextDay(day),tz)).toISOString();
   const rows=[];for(let offset=0;;offset+=500){const r=await supabase.from('location_assignments').select('id,personnel_id,role_label').eq('location_id',locationId).lt('assigned_at',end).or(`unassigned_at.is.null,unassigned_at.gt.${start}`).order('id').range(offset,offset+499);if(r.error)throw r.error;rows.push(...r.data??[]);if((r.data??[]).length<500)break;}
   const names=[];const periods=[];
   for(let offset=0;offset<rows.length;offset+=200){const batch=rows.slice(offset,offset+200);const [n,p]=await Promise.all([supabase.from('personnel_directory').select('id,first_name,last_name').in('id',batch.map(r=>r.personnel_id)),supabase.from('location_assignment_roles').select('assignment_id,role_label,effective_from').in('assignment_id',batch.map(r=>r.id)).lte('effective_from',end)]);if(n.error)throw n.error;if(p.error)throw p.error;names.push(...n.data??[]);periods.push(...p.data??[]);}
   const saved=await supabase.from('visit_personnel').select('personnel_id').eq('demobe_task_order_id',order.id);if(saved.error)throw saved.error;
   return rows.map(r=>({...r,role_label:roleAt(periods,r.id,start,r.role_label),name:[names.find(n=>n.id===r.personnel_id)?.first_name,names.find(n=>n.id===r.personnel_id)?.last_name].filter(Boolean).join(' '),saved:saved.data.some(s=>s.personnel_id===r.personnel_id)}));
 }});
 useEffect(()=>{if(people.data)setSelected(people.data.filter(p=>!p.saved&&order.roles.some(r=>r.toLowerCase()===p.role_label?.toLowerCase())).map(p=>p.personnel_id));},[people.data,order.roles]);
 const save=async()=>{
  let inAt=locationTimeIso(day,mode==='hours'?'00:00':timeIn,tz),outAt:string|null=null;
  if(mode==='hours'){const h=Number(hours);if(!Number.isFinite(h)||h<=0||h>24){toast.error('Enter hours greater than zero and at most 24');return;}if(inAt)outAt=new Date(Date.parse(inAt)+h*3600000).toISOString();}
  else outAt=locationTimeIso(timeOut<=timeIn?nextDay(day):day,timeOut,tz);
  if(!inAt||!outAt||outAt<=inAt){toast.error('Enter valid demobe times');return;}
  setBusy(true);let made=0;const failed:string[]=[];
  for(const id of selected.filter(id=>!done.includes(id))){try{await log.mutateAsync({personnel_id:id,location_id:locationId,day,in_at:inAt,out_at:outAt,note:`Demobe — TO ${order.number}; ${mode==='hours'?'hours-only allocation from local midnight':'specified times'}; travel time ${order.travelTime===null?'unspecified':order.travelTime?'included':'not included'}`,demobeTaskOrderId:order.id});made++;setDone(d=>[...d,id]);}catch(e){failed.push(`${people.data?.find(p=>p.personnel_id===id)?.name}: ${e instanceof Error?e.message:'not saved'}`);}}
  setBusy(false);if(made)toast.success(`Created ${made} demobe entries`);if(failed.length){toast.error(failed.join('; '));void people.refetch();}else onClose();
 };
 return <Dialog open onOpenChange={o=>{if(!o&&!busy)onClose();}}><DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Create demobe time entries?</DialogTitle></DialogHeader>
 <p className="text-sm">{order.number} · Travel time: {order.travelTime===null?'unspecified':order.travelTime?'included':'not included'}</p>
 <div><Label htmlFor="demobe-day">Demobe date</Label><Input id="demobe-day" type="date" value={day} disabled={busy||done.length>0} onChange={e=>setDay(e.target.value)}/></div>
 <p className="text-xs text-muted-foreground">{tz}{!timezone?' — location timezone missing':''}</p>
 <ToggleGroup type="single" value={mode} onValueChange={v=>{if(v)setMode(v);}}><ToggleGroupItem value="hours">Demobe / travel hours</ToggleGroupItem><ToggleGroupItem value="times">In / out times</ToggleGroupItem></ToggleGroup>
 {mode==='hours'?<div><Label htmlFor="demobe-hours">Demobe{order.travelTime?' / travel':''} hours</Label><Input id="demobe-hours" type="number" min="0.01" max="24" step="0.25" value={hours} onChange={e=>setHours(e.target.value)}/></div>:<div className="grid grid-cols-2 gap-3"><div><Label htmlFor="demobe-in">Time in (24h)</Label><Time24Input id="demobe-in" value={timeIn} onChange={e=>setTimeIn(e.target.value)}/></div><div><Label htmlFor="demobe-out">Time out (24h)</Label><Time24Input id="demobe-out" value={timeOut} onChange={e=>setTimeOut(e.target.value)}/></div></div>}
 <div className="max-h-64 overflow-y-auto divide-y">{people.isLoading?<p>Loading assigned people…</p>:people.error?<p role="alert" className="text-destructive">Assigned people unavailable.</p>:people.data?.map(p=><label key={p.id} className="flex items-center gap-2 py-2 text-sm"><Checkbox disabled={busy||p.saved||done.includes(p.personnel_id)} checked={selected.includes(p.personnel_id)} onCheckedChange={v=>setSelected(s=>v?[...s,p.personnel_id]:s.filter(id=>id!==p.personnel_id))}/><span>{p.name} · {p.role_label||'No role'}{p.saved?' · Demobe time already saved':''}</span></label>)}</div>
 <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background pt-3"><Button variant="outline" disabled={busy} onClick={onClose}>Skip</Button><Button disabled={busy||people.isLoading||!!people.error||!selected.some(id=>!done.includes(id))} onClick={()=>void save()}>{busy?'Saving…':'Create demobe entries'}</Button></div>
 </DialogContent></Dialog>;
}