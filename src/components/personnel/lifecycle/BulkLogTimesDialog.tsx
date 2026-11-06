import { Time24Input } from '@/components/ui/time24-input';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useLocationAssignments } from '@/integrations/supabase/hooks/useLocationStaffing';
import { useLogManualTime } from '@/integrations/supabase/hooks/useFieldMode';
import { useProject } from '@/integrations/supabase/hooks/useProjects';
import type { ProjectLocation } from '@/integrations/supabase/hooks/useProjectLocations';
import { manualTimeRange, scheduledShift } from '@/lib/manualTime';
import { localDay } from '@/lib/signinSheets';

export function BulkLogTimesDialog({ projectId, location }: { projectId: string; location: ProjectLocation }) {
  const [open,setOpen]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const zone=location.timezone||'America/Chicago';
  const [day,setDay]=useState(()=>localDay(new Date().toISOString(),zone)), [outDay,setOutDay]=useState(day);
  const [tin,setTin]=useState(''),[tout,setTout]=useState(''),[shift,setShift]=useState<'day'|'night'>('day');
  const [selected,setSelected]=useState<string[]>([]),[completed,setCompleted]=useState<string[]>([]);
  const {data:roster=[],isLoading,error:rosterError}=useLocationAssignments(location.id);
  const {data:project}=useProject(projectId),save=useLogManualTime(projectId);
  const seeded=useRef(false);
  useEffect(()=>{if(!open){seeded.current=false;return;}if(!isLoading&&!seeded.current){seeded.current=true;setSelected(roster.map(r=>r.personnel_id));setCompleted([]);setError('');}},[open,isLoading,roster]);
  const range=manualTimeRange(day,tin,tout,zone,outDay);
  return <><Button variant="outline" size="sm" onClick={()=>setOpen(true)}>Bulk log times</Button><Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto" onEscapeKeyDown={e=>{if(busy)e.preventDefault();}} onPointerDownOutside={e=>{if(busy)e.preventDefault();}}><DialogHeader><DialogTitle>Bulk log times · {location.name}</DialogTitle></DialogHeader>
    <div><Label htmlFor="bulk-date">Date</Label><Input id="bulk-date" type="date" value={day} disabled={busy||!!completed.length} onChange={e=>{setDay(e.target.value);setOutDay(e.target.value);}}/></div>
    <div className="flex gap-2"><Select value={shift} disabled={busy||!!completed.length} onValueChange={v=>setShift(v==='night'?'night':'day')}><SelectTrigger aria-label="Bulk scheduled shift"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="day">Day shift</SelectItem><SelectItem value="night">Night shift</SelectItem></SelectContent></Select><Button variant="outline" disabled={busy||!!completed.length} onClick={()=>{const s=scheduledShift(day,shift,location,project);setTin(s.timeIn);setTout(s.timeOut);setOutDay(s.outDay);}}>Use shift times</Button></div>
    <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="bulk-in">Time in (24h)</Label><Time24Input id="bulk-in"  step={60} value={tin} disabled={busy||!!completed.length} onChange={e=>setTin(e.target.value)}/></div><div><Label htmlFor="bulk-out">Time out (24h)</Label><Time24Input id="bulk-out"  step={60} value={tout} disabled={busy||!!completed.length} onChange={e=>setTout(e.target.value)}/></div></div>
    <div><Label htmlFor="bulk-out-date">Time out date</Label><Input id="bulk-out-date" type="date" min={day} value={outDay} disabled={busy||!!completed.length} onChange={e=>setOutDay(e.target.value)}/></div>
    <p className="text-xs text-muted-foreground">{range?`${range.hours.toFixed(2)} hours · `:''}{zone}</p>
    {isLoading?<Loader2 className="animate-spin"/>:rosterError?<p role="alert">Unable to load roster.</p>:<div className="divide-y max-h-64 overflow-y-auto">{roster.map(r=><label key={r.id} className="flex gap-3 items-center py-3 text-sm"><Checkbox checked={selected.includes(r.personnel_id)} disabled={busy||completed.includes(r.personnel_id)} onCheckedChange={v=>setSelected(s=>v?[...s,r.personnel_id]:s.filter(id=>id!==r.personnel_id))}/><span>{[r.personnel?.first_name,r.personnel?.last_name].filter(Boolean).join(' ')}</span>{completed.includes(r.personnel_id)&&<span className="ml-auto text-success">Saved</span>}</label>)}</div>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy||!range||!selected.some(id=>!completed.includes(id))||!!rosterError} onClick={async()=>{if(!range)return;setBusy(true);setError('');let done=[...completed];try{for(const id of selected.filter(id=>!done.includes(id))){await save.mutateAsync({personnel_id:id,location_id:location.id,day,in_at:range.inAt,out_at:range.outAt,note:'Paper-sheet backfill'});done.push(id);setCompleted([...done]);}setOpen(false);}catch(e){setError(`${done.length} saved; remaining people not saved. ${e instanceof Error?e.message:'Try again.'}`);}finally{setBusy(false);}}}>{busy&&<Loader2 className="mr-1 h-4 w-4 animate-spin"/>}Save selected</Button></DialogFooter>
  </DialogContent></Dialog></>;
}