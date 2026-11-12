import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskOrderHistoryTable } from '@/components/project-hub/TaskOrderHistoryTable';
import type { HistoryHeader } from '@/lib/taskOrderHistoryExport';
import { authorizedLevel, authorizationLines, type AuthorizationLine, type EventRow } from '@/lib/eventManager';
import {TaskOrderLinesEditor} from '@/components/project-hub/TaskOrderLinesEditor';
import {blankOrderLine,deductionDrafts,creationLines,deductive,type OrderLineDraft} from '@/lib/taskOrderCreation';
import type {TaskOrderKind} from '@/lib/locationAuthorization';
import { formatLocalDate } from '@/lib/dateUtils';

type Props={header?:HistoryHeader;orders:EventRow<'event_task_orders'>[];companies:EventRow<'event_companies'>[];day:string;closed:boolean;save:(values:{number:string;kind:string;effective_date:string;company_id:string|null;notes:string;lines:AuthorizationLine[]})=>Promise<void>};
export function EventTaskOrders({header,orders,companies,day,closed,save}:Props) {
 const [open,setOpen]=useState(false),[number,setNumber]=useState(''),[kind,setKind]=useState('initial'),[date,setDate]=useState(day),[company,setCompany]=useState(''),[notes,setNotes]=useState(''),[lines,setLines]=useState<OrderLineDraft[]>([{...blankOrderLine(),label:'Pax'}]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const levels=useMemo(()=>[...new Set(orders.filter(o=>o.company_id===(company||null)&&o.effective_date<=date).flatMap(o=>authorizationLines(o.lines).map(l=>l.label)))].map(label=>({line_kind:'position',label,authorized:authorizedLevel(orders,date,company||null,label)})),[orders,date,company]);
 useEffect(()=>{if(open&&deductive(kind))setLines(deductionDrafts(levels));},[open,kind,levels]);
 return <div className="space-y-3"><Button disabled={closed} onClick={()=>{setNumber('');setKind(orders.length?'increase':'initial');setDate(day);setCompany('');setNotes('');setLines([{...blankOrderLine(),label:'Pax'}]);setError('');setOpen(true);}}><Plus className="h-4 w-4 mr-2"/>New task order / addendum</Button>
 <TaskOrderHistoryTable today={day} header={header??{title:'Task-order history',fields:[]}} fileBase="event-task-orders" orders={orders.map(o=>({id:o.id,number:o.number,kind:o.kind,effective_date:o.effective_date,created_at:o.created_at,counts:true,scope:o.company_id?companies.find(c=>c.id===o.company_id)?.name??'Company':null,lines:authorizationLines(o.lines).map(l=>({label:l.label,qty_delta:l.qty_delta})),notes:o.notes,enteredBy:formatLocalDate(o.created_at)}))}/>
 <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>New task order / addendum</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={async e=>{e.preventDefault();setError('');setBusy(true);try{await save({number:number.trim(),kind,effective_date:date,company_id:company||null,notes:notes.trim(),lines:creationLines(kind as TaskOrderKind,lines,levels).map(({label,qty_delta})=>({label,qty_delta}))});setOpen(false);}catch(e){setError((e as {code?:string}).code==='23505'?'This TO / addendum number already exists.':(e as {message?:string}).message??'Could not save');}finally{setBusy(false);}}}>
 <h3 className="text-sm font-semibold">1. Order info</h3><div className="space-y-1"><Label htmlFor="to-number">TO / addendum number</Label><Input id="to-number" value={number} required onChange={e=>setNumber(e.target.value)}/></div>
 <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label htmlFor="to-kind">Kind</Label><select id="to-kind" className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={kind} onChange={e=>{setKind(e.target.value);if(!deductive(e.target.value))setLines([{...blankOrderLine(),label:'Pax'}]);}}>{['initial','increase','decrease','demobilization'].map(k=><option key={k} value={k}>{k}</option>)}</select></div><div className="space-y-1"><Label htmlFor="to-date">Effective date</Label><Input id="to-date" type="date" value={date} required onChange={e=>setDate(e.target.value)}/></div></div>
 <div className="space-y-1"><Label htmlFor="to-company">Company (optional)</Label><select id="to-company" className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={company} onChange={e=>setCompany(e.target.value)}><option value="">Whole location</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
 <TaskOrderLinesEditor event kind={kind} lines={lines} setLines={setLines} levels={levels}/><h3 className="text-sm font-semibold border-t pt-3">3. Options</h3>
 <div className="space-y-1"><Label htmlFor="to-notes">Notes / details</Label><Textarea id="to-notes" value={notes} onChange={e=>setNotes(e.target.value)}/></div>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background pt-3"><Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy?'Saving…':'Save'}</Button></div></form></DialogContent></Dialog></div>;
}