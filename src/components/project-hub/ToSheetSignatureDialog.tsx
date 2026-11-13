import {useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Label} from '@/components/ui/label';
import {Time24Input} from '@/components/ui/time24-input';
import {SignaturePad} from '@/components/documents/SignaturePad';
import {locationTimeIso} from '@/lib/manualTime';
import {nextDay} from '@/lib/signinSheets';
import {toast} from 'sonner';
export function ToSheetSignatureDialog({sheetId,personId,name,role,day,projectId,timezone,onClose}:{sheetId:string;personId:string;name:string;role:string;day:string;projectId:string;timezone:string;onClose:()=>void}){
 const [timeIn,setTimeIn]=useState(''),[timeOut,setTimeOut]=useState(''),[busy,setBusy]=useState(false);
 const save=async(blob:Blob)=>{const start=locationTimeIso(day,timeIn,timezone),end=locationTimeIso(timeOut<=timeIn?nextDay(day):day,timeOut,timezone);if(!start||!end){toast.error('Enter valid military times');return;}setBusy(true);const path=`${projectId}/to-sheets/${sheetId}/${crypto.randomUUID()}.png`;try{const upload=await supabase.storage.from('project-documents').upload(path,blob,{contentType:'image/png',upsert:false});if(upload.error)throw upload.error;const result=await supabase.rpc('record_to_sheet_signature',{p_sheet:sheetId,p_person:personId,p_role:role,p_in:start,p_out:end,p_path:path});if(result.error){await supabase.storage.from('project-documents').remove([path]);throw result.error;}toast.success('Signed TO sheet saved');onClose();}catch(e){toast.error(e instanceof Error?e.message:'Signature could not be saved');}finally{setBusy(false);}};
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>TO sign-in · {name}</DialogTitle></DialogHeader><p className="text-sm">{day} · {role} · {timezone}</p><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="to-sheet-in">Time in</Label><Time24Input id="to-sheet-in" value={timeIn} onChange={e=>setTimeIn(e.target.value)}/></div><div><Label htmlFor="to-sheet-out">Time out</Label><Time24Input id="to-sheet-out" value={timeOut} onChange={e=>setTimeOut(e.target.value)}/></div></div><SignaturePad name={name} required saving={busy} description="" onSave={blob=>void save(blob)} onSkip={onClose}/></DialogContent></Dialog>;
}