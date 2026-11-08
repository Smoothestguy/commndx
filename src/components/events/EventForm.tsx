import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
export type FormField={key:string;label:string;type?:string;required?:boolean;options?:{value:string;label:string}[]};
export type FormSpec={title:string;fields:FormField[];initial?:Record<string,string>;save:(values:Record<string,string>)=>Promise<void>};
export function EventForm({spec,onClose}:{spec:FormSpec;onClose:()=>void}) {
 const [values,setValues]=useState(spec.initial??{}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{spec.title}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await spec.save(values);onClose();}catch(e){setError(e instanceof Error?e.message:(e as {message?:string})?.message??'Could not save');}finally{setBusy(false);}}}>{spec.fields.map(f=><div key={f.key} className="space-y-1"><Label htmlFor={f.key}>{f.label}</Label>{f.options?<select id={f.key} aria-label={f.label} required={f.required} className="h-10 w-full border border-input rounded-md bg-background px-3 text-sm" value={values[f.key]??''} onChange={e=>setValues({...values,[f.key]:e.target.value})}><option value="">Select…</option>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:f.type==='textarea'?<Textarea id={f.key} aria-label={f.label} required={f.required} value={values[f.key]??''} onChange={e=>setValues({...values,[f.key]:e.target.value})}/>:<Input id={f.key} aria-label={f.label} type={f.type??'text'} required={f.required} value={values[f.key]??''} onChange={e=>setValues({...values,[f.key]:e.target.value})}/>}</div>)}{error&&<p role="alert" className="text-destructive text-sm">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} type="button" onClick={onClose}>Cancel</Button><Button disabled={busy} type="submit">{busy?'Saving…':'Save'}</Button></div></form></DialogContent></Dialog>;
}
