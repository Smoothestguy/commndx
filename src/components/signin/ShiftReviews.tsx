import { useState } from 'react';
import { useShiftReviews, useReviewShift } from '@/hooks/useShiftReviews';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import type { ProjectLocation } from '@/integrations/supabase/hooks/useProjectLocations';
import { useProject } from '@/integrations/supabase/hooks/useProjects';
import { earlyMinutes } from '@/lib/shiftDiscipline';
export function ShiftReviews({ projectId, locations }: { projectId:string;locations:ProjectLocation[] }) {
 const [open,setOpen]=useState(false),query=useShiftReviews(projectId,locations.map(l=>l.id)),review=useReviewShift();const {data:project}=useProject(projectId);const early=query.data?.early||[],extensions=query.data?.extensions||[];
 if(query.error)return <p role="alert" className="text-destructive text-sm">Shift reviews could not load.</p>;
 if(!early.length&&!extensions.length)return null;
 const location=(id:string)=>locations.find(l=>l.id===id),time=(at:string,id:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:location(id)?.timezone||'America/Chicago',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(at));
 return <section className="border border-warning bg-warning/10 rounded-md px-3 py-2"><Button variant="ghost" className="text-warning gap-2 whitespace-normal text-left h-auto min-h-11" onClick={()=>setOpen(v=>!v)} aria-expanded={open}><ChevronDown className="h-4 w-4 shrink-0"/>{early.length} early arrivals · {extensions.length} extension requests</Button>
 {open&&<div className="divide-y divide-border">{early.map(r=><div key={r.id} className="py-3 flex flex-wrap items-center gap-2"><div className="flex-1 min-w-[180px]"><p className="text-sm font-medium">{[r.first_name,r.last_name].filter(Boolean).join(' ')} · {location(r.location_id)?.name}</p><p className="text-xs text-muted-foreground">{earlyMinutes(r.in_at,location(r.location_id)?.timezone||'America/Chicago',location(r.location_id)?.day_shift_start||project?.day_shift_start||'06:00',location(r.location_id)?.night_shift_start||project?.night_shift_start||'18:00')} min early · {time(r.in_at,r.location_id)} · {r.early_in_reason}</p></div><Button size="sm" disabled={review.isPending} onClick={()=>review.mutate({id:r.id,kind:'early',status:'approved'})}>Approve</Button></div>)}
 {extensions.map(r=><div key={r.id} className="py-3 flex flex-wrap items-center gap-2"><div className="flex-1 min-w-[180px]"><p className="text-sm font-medium">{r.name} · {location(r.location_id)?.name}</p><p className="text-xs text-muted-foreground">{r.reason} · Requested until {time(r.until_at,r.location_id)}</p></div><Button size="sm" disabled={review.isPending} onClick={()=>review.mutate({id:r.id,kind:'extension',status:'approved'})}>Approve</Button><Button size="sm" variant="outline" disabled={review.isPending} onClick={()=>review.mutate({id:r.id,kind:'extension',status:'denied'})}>Deny</Button></div>)}</div>}
 </section>;
}