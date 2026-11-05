import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ForceDarkTheme } from '@/components/ForceDarkTheme';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SignaturePad } from '@/components/documents/SignaturePad';
import { getSheetGps, KIOSK_REFRESH_MS, KIOSK_RETURN_MS } from '@/lib/sheetApprovalRules';
import { localTime } from '@/lib/signinSheets';
import { Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { EarlyCheckIn } from '@/components/signin/EarlyCheckIn';
type Person = { personnel_id: string; name: string; on_site: boolean; since?: string | null };
type Info = { valid: boolean; location_name: string; timezone: string; roster: Person[] };
const base64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(blob); });
export default function Kiosk() {
 const { token } = useParams(); const [info,setInfo]=useState<Info|null>(null),[person,setPerson]=useState<Person|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(''),[rejection,setRejection]=useState<{reason:string;distance_m?:number;radius_m?:number;shift_start?:string;early_minutes?:number}|null>(null),[reason,setReason]=useState('');
 const earlyReason=useRef<string>(),offsiteReason=useRef<string>();
 const signature=useRef<string>(),pending=useRef<string>(),mutex=useRef(false);
 const load=async()=>{if(!token)return;const {data,error}=await supabase.functions.invoke('kiosk-signature',{body:{action:'info',token}});if(error){setError('Kiosk unavailable or link expired. Ask your supervisor.');setInfo(null);}else{setInfo(data);setError('');}};
 useEffect(()=>{void load();const interval=setInterval(()=>{if(!mutex.current)void load();},KIOSK_REFRESH_MS);return()=>clearInterval(interval);},[token]);
 useEffect(()=>{if(!done)return;const timer=setTimeout(()=>{setDone('');setPerson(null);setRejection(null);setReason('');signature.current=undefined;pending.current=undefined;earlyReason.current=undefined;offsiteReason.current=undefined;void load();},KIOSK_RETURN_MS);return()=>clearTimeout(timer);},[done]);
 const send=async(blob?:Blob,override?:string,early?:string)=>{
  if(!person||!token||mutex.current)return;mutex.current=true;setBusy(true);setError('');
  try {if(override)offsiteReason.current=override;if(early)earlyReason.current=early;if(blob)signature.current=await base64(blob);const pos=await getSheetGps();const {data,error}=await supabase.functions.invoke('kiosk-signature',{body:{action:pending.current?'save':'punch',token,personnel_id:person.personnel_id,expected:person.on_site?'out':'in',signature:signature.current,stay_id:pending.current,lat:pos?.lat??null,lng:pos?.lng??null,accuracy:pos?.accuracy??null,override_reason:offsiteReason.current,early_reason:earlyReason.current}});
   if(error)throw new Error('Could not complete this punch. Refresh the roster before trying again.');
   if(!data?.ok){if(data?.reason==='signature_pending'){pending.current=data.stay_id;setError('Check-in recorded. Retry signature saving; do not check in again.');}else if(['out_of_range','no_gps','before_shift'].includes(data?.reason)){setRejection(data);}else{setError(data?.reason==='sheet_locked'?'This sheet is locked. Ask a manager to re-open it.':data?.reason==='already_signed_today'?'Already signed in today at this site.': 'Status changed or punch unavailable. Return to roster.');}return;}
   setDone(`${person.name} — ${data.action==='out'?'checked out':'signed in'}${data.offsite?' · Recorded as off-site — supervisor will review':''}${data.early_flagged?' · Early check-in — pending supervisor approval':''}`);
  }catch(e){setError(e instanceof Error?e.message:'Punch failed');}finally{setBusy(false);mutex.current=false;}
 };
 return <><ForceDarkTheme /><main className="min-h-dvh bg-background text-foreground p-4 sm:p-8 max-w-6xl mx-auto"><h1 className="text-3xl font-semibold mb-6">{info?.location_name||'Location sign-in'}</h1>
 {done?<div role="status" className="py-16 text-center space-y-4"><CheckCircle2 className="h-20 w-20 text-success mx-auto"/><p className="text-2xl">{done}</p></div>:person?<><Button variant="ghost" disabled={busy||!!pending.current} onClick={()=>{setPerson(null);setError('');setRejection(null);void load();}}><ArrowLeft className="h-4 w-4 mr-2"/>Roster</Button><h2 className="text-2xl my-4">{person.on_site?'Confirm check OUT':`Sign in, ${person.name.split(' ')[0]}`}</h2>
 {rejection?.reason==='before_shift'?<EarlyCheckIn rejection={rejection} timezone={info?.timezone} busy={busy} onSubmit={r=>send(undefined,undefined,r)}/>:rejection?<section className="space-y-4 py-6"><p className="text-xl text-warning">{rejection.reason==='no_gps'?"Couldn't get your location":`You're ${Math.round(rejection.distance_m||0)}m from ${info?.location_name} (allowed ${rejection.radius_m}m)`}</p><Textarea aria-label="Supervisor override reason" placeholder="Supervisor override reason" value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/><Button size="lg" disabled={busy||!reason.trim()} onClick={()=>send(undefined,reason.trim())}>I'M ON SITE ANYWAY</Button></section>:person.on_site?<Button size="lg" className="h-20 text-xl w-full" disabled={busy} onClick={()=>send()}>Confirm check OUT</Button>:<SignaturePad compact name={person.name.split(' ')[0]} description="Sign to check in" required saving={busy} onSkip={()=>{}} onSave={blob=>send(blob)}/>}
 {pending.current&&<Button disabled={busy} onClick={()=>send()}>Retry signature saving</Button>}</>:!info&&!error?<Loader2 aria-label="Loading roster" className="animate-spin"/>:<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{info?.roster.map(p=><Button key={p.personnel_id} variant="outline" className={`h-28 text-xl flex-col whitespace-normal ${p.on_site?'bg-success/20 border-success text-success':''}`} onClick={()=>{setPerson(p);setError('');signature.current=undefined;pending.current=undefined;earlyReason.current=undefined;offsiteReason.current=undefined;}}><span>{p.name}</span>{p.on_site&&<span className="text-sm">On site{p.since?` · since ${localTime(p.since,info.timezone)}`:''}</span>}</Button>)}</div>}
 {busy&&<Loader2 aria-label="Recording punch" className="animate-spin mx-auto mt-4"/>}{error&&<p role="alert" className="text-destructive py-4 text-lg">{error}</p>}
 </main></>;
}
