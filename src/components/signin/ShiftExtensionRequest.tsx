import { usePublicLang } from '@/lib/publicLang';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EXTENSION_REASONS, extensionChoices,reportedCheckoutChoices } from '@/lib/shiftDiscipline';
type Extension = { status: string; until_at: string };
export function ShiftExtensionRequest({ token,initialOpen=false }: { token: string;initialOpen?:boolean }) {
  const { tr } = usePublicLang();
  const [open,setOpen]=useState(initialOpen),[choice,setChoice]=useState(''),[text,setText]=useState(''),[until,setUntil]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [info,setInfo]=useState<{timezone?:string;shift_end?:string;extension?:Extension|null;auto_closed?:boolean}>({});
  useEffect(() => { let active=true; const load=async()=>{const {data,error}=await supabase.functions.invoke('shift-discipline',{body:{action:'info',token}});if(active&&!error)setInfo(data);};void load();const timer=setInterval(load,60_000);return()=>{active=false;clearInterval(timer);}; },[token]);
  const time=(at:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:info.timezone||'America/Chicago',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(at)).replace(':','');
  const choices=info.auto_closed?reportedCheckoutChoices(Date.now(),info.shift_end):extensionChoices(Date.now(),info.shift_end),reason=choice==='Other'?text.trim():choice;
  const submit=async()=>{if(!reason||!until)return;setBusy(true);setError('');try{const {data,error}=await supabase.rpc(info.auto_closed?'request_closed_shift_extension':'request_shift_extension',{p_token:token,p_reason:reason,p_until:until});const result=data as {ok?:boolean;until?:string;status?:string}|null;if(error||!result?.ok||!result.until)throw new Error(info.auto_closed?'Choose your later checkout within six hours of schedule. Locked records require the office.':'Request not accepted. Choose a future time within six hours.');setInfo(i=>({...i,extension:{status:result.status||'pending',until_at:result.until||until}}));setOpen(false);}catch(e){setError(e instanceof Error?e.message:'Could not request extension');}finally{setBusy(false);}};
  return <div className="space-y-2">{info.auto_closed&&<p className="text-warning">{tr('Forgot to clock out — closed per schedule. Report your checkout if you worked later.','Olvidaste registrar salida — cerrado según horario. Reporta tu salida si trabajaste más.')} {info.shift_end&&time(info.shift_end)}</p>}<Button variant="outline" className="w-full min-h-14" onClick={()=>{setUntil(choices[0]||'');setError('');setOpen(true);}}>{info.auto_closed?tr('Report later checkout','Reportar salida posterior'):tr('Staying longer?', '¿Te quedas más tiempo?')}</Button>
    {info.extension&&<p role="status" className={info.extension.status==='denied'?'text-destructive':'text-warning'}>{info.extension.status==='pending'?'Requested':'Extension'} until {time(info.extension.until_at)} — {info.extension.status==='pending'?'pending approval':info.extension.status}</p>}
    <Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{info.auto_closed?tr('Report later checkout','Reportar salida posterior'):tr('Staying longer?', '¿Te quedas más tiempo?')}</DialogTitle></DialogHeader>
      <div className="flex flex-wrap gap-2">{EXTENSION_REASONS.map(r=><Button key={r} variant={choice===r?'default':'outline'} className="min-h-11" onClick={()=>setChoice(r)}>{r}</Button>)}</div>
      {choice==='Other'&&<Textarea aria-label="Extension reason" maxLength={200} placeholder="Reason (required)" value={text} onChange={e=>setText(e.target.value)}/>}
      <label className="text-sm">Until</label><Select value={until} onValueChange={setUntil}><SelectTrigger aria-label="Until"><SelectValue/></SelectTrigger><SelectContent>{choices.map(at=><SelectItem key={at} value={at}>{time(at)}</SelectItem>)}</SelectContent></Select>
      {error&&<p role="alert" className="text-destructive">{error}</p>}<Button className="min-h-14" disabled={busy||!reason||!choices.includes(until)} onClick={submit}>Request extension</Button>
    </DialogContent></Dialog>
  </div>;
}