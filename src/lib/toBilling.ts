import {localDay,midnight,nextDay} from './signinSheets';
import {capMobilization,toBill,toRate,type ToTerms} from './taskOrderEngine';
export type BillingSource={orders:{id:string;to_number:string;customer_ref:string|null;status:string;effective_date:string;effective_time:string|null}[];terms:(ToTerms&{task_order_id:string})[];allocations:{task_order_id:string;line_kind:string;label:string;personnel_id:string|null;asset_assignment_id:string|null;effective_from:string;effective_until:string|null}[];stays:{id:string;personnel_id:string;in_at:string;out_at:string|null;signed_at:string|null;signature_url:string|null;non_billable:boolean;agency_id:string|null}[];assets:{id:string;start_at:string;end_at:string|null;type:string;label:string;billable:boolean}[];sheet_entries:{id:string;task_order_id:string;kind:string;personnel_id:string;role_label:string;in_at:string;out_at:string;non_billable:boolean;visit_personnel_id:string}[]};
export type ToBillingRow={id:string;number:string;customerRef:string;laborHours:number;housingDays:number;perDiemDays:number;assetDays:number;mobeHours:number;demobeHours:number;labor:number|null;housing:number|null;perDiem:number|null;assets:number|null;mobe:number|null;demobe:number|null;total:number|null;unallocated:number};
export function calculateToBilling(src:BillingSource,tz:string,at=Date.now()):ToBillingRow[]{
 const dayOwner=new Map<string,{order:string;at:number}>();
 const assetOwner=new Map<string,{order:string;at:number}>();
 for(const a of src.allocations){
 const stays=a.personnel_id?src.stays.filter(s=>s.personnel_id===a.personnel_id&&s.signed_at&&s.signature_url&&s.out_at&&!s.non_billable&&!src.sheet_entries.some(e=>e.visit_personnel_id===s.id)):[];
 const asset=a.asset_assignment_id?src.assets.find(x=>x.id===a.asset_assignment_id&&x.billable):null;
 const spans=stays.map(s=>({id:s.personnel_id,start:Date.parse(s.in_at),end:Date.parse(s.out_at??'')}));if(asset)spans.push({id:asset.id,start:Date.parse(asset.start_at),end:asset.end_at?Date.parse(asset.end_at):at});
 for(const span of spans){const start=Math.max(span.start,Date.parse(a.effective_from)),end=Math.min(span.end,a.effective_until?Date.parse(a.effective_until):at);if(end<=start)continue;let day=localDay(new Date(start).toISOString(),tz);while(midnight(day,tz)<end){const key=`${span.id}:${day}`,map=asset?assetOwner:dayOwner,old=map.get(key);if(!old||start<old.at)map.set(key,{order:a.task_order_id,at:start});day=nextDay(day);}}
 }
 return src.orders.map(o=>{
 const t=src.terms.find(t=>t.task_order_id===o.id);const row:ToBillingRow={id:o.id,number:o.to_number,customerRef:o.customer_ref??'',laborHours:0,housingDays:0,perDiemDays:0,assetDays:0,mobeHours:0,demobeHours:0,labor:t?0:null,housing:t?0:null,perDiem:t?0:null,assets:t?0:null,mobe:t?0:null,demobe:t?0:null,total:null,unallocated:0};
 if(o.status!=='accepted'||!t)return row;
 const personDays=new Set<string>();const assetDays=new Set<string>();
 for(const a of src.allocations.filter(a=>a.task_order_id===o.id)){
 if(a.personnel_id){for(const s of src.stays.filter(s=>s.personnel_id===a.personnel_id&&s.out_at&&s.signed_at&&s.signature_url&&!s.non_billable&&!src.sheet_entries.some(e=>e.visit_personnel_id===s.id))){
 const start=Math.max(Date.parse(s.in_at),Date.parse(a.effective_from));const end=Math.min(Date.parse(s.out_at??''),a.effective_until?Date.parse(a.effective_until):at);if(end<=start)continue;
 const h=(end-start)/3600000;row.laborHours+=h;const amount=toBill(h,toRate(t,'position',a.label));row.labor=amount===null||row.labor===null?null:row.labor+amount;
 let day=localDay(new Date(start).toISOString(),tz);while(midnight(day,tz)<end){const key=`${s.personnel_id}:${day}`;if(dayOwner.get(key)?.order===o.id)personDays.add(key);day=nextDay(day);}
 }}else {const asset=src.assets.find(x=>x.id===a.asset_assignment_id&&x.billable);if(!asset)continue;const start=Math.max(Date.parse(asset.start_at),Date.parse(a.effective_from));const end=Math.min(asset.end_at?Date.parse(asset.end_at):at,a.effective_until?Date.parse(a.effective_until):at);if(end<=start)continue;let day=localDay(new Date(start).toISOString(),tz);while(midnight(day,tz)<end){const key=`${asset.id}:${day}`;if(!assetDays.has(key)){assetDays.add(key);const amount=toBill(1,toRate(t,'asset',a.label));row.assets=amount===null||row.assets===null?null:row.assets+amount;}day=nextDay(day);}}
 }
 row.housingDays=t.housing_enabled?personDays.size:0;row.perDiemDays=t.per_diem_enabled?personDays.size:0;row.assetDays=assetDays.size;row.housing=row.housingDays*t.housing_rate;row.perDiem=row.perDiemDays*t.per_diem_rate;
 for(const e of src.sheet_entries.filter(e=>e.task_order_id===o.id&&!e.non_billable)){const h=(Date.parse(e.out_at)-Date.parse(e.in_at))/3600000;const amount=t.mobe_approved?toBill(h,toRate(t,'position',e.role_label)):0;if(e.kind==='mobe'){row.mobeHours+=h;row.mobe=amount===null||row.mobe===null?null:row.mobe+amount;}else{row.demobeHours+=h;row.demobe=amount===null||row.demobe===null?null:row.demobe+amount;}}
 row.mobe=capMobilization(row.mobe,t.mobe_cap);const amounts=[row.labor,row.housing,row.perDiem,row.assets,row.mobe,row.demobe];row.total=amounts.some(x=>x===null)?null:amounts.reduce<number>((n,x)=>n+(x??0),0);return row;
 });
}