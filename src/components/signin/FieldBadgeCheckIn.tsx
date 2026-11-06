import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BadgeScanner } from './BadgeScanner';
import { SignaturePad } from '@/components/documents/SignaturePad';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCheckIn, fetchTodaySignatures } from '@/integrations/supabase/hooks/useFieldMode';
import { getSheetGps } from '@/lib/sheetApprovalRules';
import { LateCheckIn } from './LateCheckIn';
import { EarlyCheckIn } from './EarlyCheckIn';
import type { ProjectLocation } from '@/integrations/supabase/hooks/useProjectLocations';
import type { EarlyRejection } from '@/lib/shiftDiscipline';
export function FieldBadgeCheckIn({ location, projectId, locationIds, onDone }: { location: ProjectLocation; projectId: string; locationIds: string[]; onDone: () => void }) {
  const [person,setPerson]=useState<{id:string;first_name:string;last_name:string}|null>(null),[error,setError]=useState(''),[resolving,setResolving]=useState(false),[needsSignature,setNeedsSignature]=useState(false),[drawn,setDrawn]=useState<Blob|undefined>(),[rejection,setRejection]=useState<EarlyRejection|null>(null),[override,setOverride]=useState(''),[early,setEarly]=useState<string|undefined>();
  const [late,setLate]=useState<string>();
  const checkIn=useCheckIn(projectId,locationIds);
  const send=async(p=person,blob=drawn,earlyReason=early,overrideReason=override,lateReason=late)=>{
    if(!p)return;setDrawn(blob);setEarly(earlyReason);setLate(lateReason);setError('');
    const coords=await getSheetGps();
    checkIn.mutate({location_id:location.id,crew_id:null,memberIds:[p.id],lat:coords?.lat??null,lng:coords?.lng??null,signatures:blob?{[p.id]:blob}:{},earlyReason,lateReason,overrideReason:overrideReason||undefined},{onSuccess:onDone,onError:e=>{const r=(e as Error & {rejection?:EarlyRejection}).rejection;if(r)setRejection(r);else setError(e.message);}});
  };
  const scan=async(badge:string)=>{setResolving(true);setError('');try{const {data,error}=await supabase.functions.invoke('badge-management',{body:{action:'resolve',badge,location_id:location.id}});if(error||!data?.person)throw new Error('Badge inactive or person not assigned to this site.');setPerson(data.person);const signed=await fetchTodaySignatures(locationIds,[data.person.id],location.id);if(signed[data.person.id])await send(data.person);else setNeedsSignature(true);}catch(e){setError(e instanceof Error?e.message:'Badge unavailable');}finally{setResolving(false);}};
  return <div className="p-4 space-y-4"><h2 className="text-xl font-semibold">{location.name}</h2>{rejection?.reason==='late'?<LateCheckIn rejection={rejection} timezone={location.timezone||undefined} busy={checkIn.isPending} onSubmit={r=>send(person,drawn,early,override,r)}/>:rejection?.reason==='before_shift'?<EarlyCheckIn rejection={rejection} timezone={location.timezone||undefined} busy={checkIn.isPending} onSubmit={r=>send(person,drawn,r)}/>:rejection?<><p className="text-warning">{['no_gps','out_of_range'].includes(rejection.reason)?'Location unavailable or outside the geofence':'Check-in unavailable — ask your supervisor'}</p>{['no_gps','out_of_range'].includes(rejection.reason)&&<><Textarea aria-label="Off-site reason" value={override} onChange={e=>setOverride(e.target.value)} placeholder="Required reason"/><Button disabled={checkIn.isPending||!override.trim()} onClick={()=>void send()}>I'M ON SITE ANYWAY</Button></>}</>:person&&needsSignature?<SignaturePad required name={`${person.first_name} ${person.last_name}`} saving={checkIn.isPending} onSkip={()=>{}} onSave={blob=>void send(person,blob)}/>:<BadgeScanner onScan={badge=>void scan(badge)} paused={resolving||checkIn.isPending||!!person}/>}<Button variant="outline" disabled={checkIn.isPending||resolving} onClick={()=>{setPerson(null);setRejection(null);setNeedsSignature(false);setDrawn(undefined);setEarly(undefined);setLate(undefined);setOverride('');setError('');}}>Scan another badge</Button>{error&&<p role="alert" className="text-destructive">{error}</p>}</div>;
}