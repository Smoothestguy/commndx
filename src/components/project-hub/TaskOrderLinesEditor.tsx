import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Plus,Trash2} from 'lucide-react';
import {RolePicker} from './LocationStaffing';
import {ROLE_TAGS} from '@/lib/roleTags';
import {blankOrderLine,currentLevel,deductive,type OrderLineDraft} from '@/lib/taskOrderCreation';
import type {AuthorizationLevel} from '@/lib/locationAuthorization';
const ASSET_TYPES=['truck','vehicle','trailer','bunk_trailer','generator','pump','equipment','other'];
export function TaskOrderLinesEditor({kind,lines,setLines,levels,loading,error,event=false,billing=false}:{kind:string;lines:OrderLineDraft[];setLines:(lines:OrderLineDraft[])=>void;levels:AuthorizationLevel[];loading?:boolean;error?:boolean;event?:boolean;billing?:boolean}) {
 const down=deductive(kind);
 const update=(id:string,changes:Partial<OrderLineDraft>)=>setLines(lines.map(l=>l.id===id?{...l,...changes}:l));
 return <section className="space-y-2 border-t pt-3"><h3 className="text-sm font-semibold">2. Lines</h3>
 {loading?<p className="text-sm text-muted-foreground">Loading current levels…</p>:error?<p role="alert" className="text-destructive">Current levels unavailable.</p>:<>
 {down&&!lines.length&&<p className="text-sm text-muted-foreground">No currently authorized labels on this date.</p>}
 {lines.map((l,i)=>{const current=currentLevel(levels,l);return <div key={l.id} className="flex flex-wrap items-center gap-2">
 {!down&&!event&&<Select value={l.line_kind} onValueChange={v=>update(l.id,{line_kind:v as OrderLineDraft['line_kind'],label:''})}><SelectTrigger className="w-28" aria-label={`Line ${i+1} type`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="position">Position</SelectItem><SelectItem value="asset">Asset</SelectItem></SelectContent></Select>}
 <div className="flex-1 min-w-36">{down?<span className="text-sm font-medium">{l.label} — currently {current} → deduct</span>:<>{!event&&l.line_kind==='position'?<RolePicker value={l.label} onChange={label=>update(l.id,{label})} options={[...ROLE_TAGS]}/>:event?<Input aria-label={`Line ${i+1} label`} required placeholder="Label" value={l.label} onChange={e=>update(l.id,{label:e.target.value})}/>:<Select value={l.label} onValueChange={label=>update(l.id,{label})}><SelectTrigger aria-label={`Asset type ${i+1}`}><SelectValue placeholder="Asset type"/></SelectTrigger><SelectContent>{[...new Set([...ASSET_TYPES,...levels.filter(x=>x.line_kind==='asset').map(x=>x.label)])].map(type=><SelectItem key={type} value={type}>{type.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select>}<p className="text-xs text-muted-foreground">Currently {current}</p></>}</div>
 <Input className="w-24" aria-label={down?`Deduct ${l.label}`:`Quantity ${i+1}`} type="number" min={down||event?0:1} max={down?current:undefined} step={event?'any':1} required value={l.qty} onChange={e=>update(l.id,{qty:e.target.value})}/>
 {billing&&<><Input className="w-28" aria-label={`Billing rate ${i+1}`} placeholder={l.line_kind==='asset'?'Rate / day':'Rate / hour'} type="number" min="0" step="0.01" value={l.rate??''} onChange={e=>update(l.id,{rate:e.target.value})}/><span className="text-xs text-muted-foreground">{current} {down?'−':'+'} {Number(l.qty)||0} → {Math.max(0,current+(down?-1:1)*(Number(l.qty)||0))}</span></>}
 {!down&&<Button type="button" size="icon" variant="ghost" aria-label={`Remove line ${i+1}`} disabled={lines.length===1} onClick={()=>setLines(lines.filter(r=>r.id!==l.id))}><Trash2 className="h-4 w-4"/></Button>}
 </div>;})}
 {!down&&<Button type="button" variant="outline" size="sm" onClick={()=>setLines([...lines,blankOrderLine()])}><Plus className="h-4 w-4 mr-1"/>Add line</Button>}
 </>}
 </section>;
}