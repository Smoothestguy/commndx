export type ToRate={line_kind:'position'|'asset';label:string;rate:number|null};
export type ToTerms={housing_enabled:boolean;housing_rate:number;per_diem_enabled:boolean;per_diem_rate:number;mobe_approved:boolean;mobe_terms:string|null;mobe_cap:number|null;line_rates:ToRate[]};
export const emptyToTerms=():ToTerms=>({housing_enabled:false,housing_rate:0,per_diem_enabled:false,per_diem_rate:0,mobe_approved:false,mobe_terms:null,mobe_cap:null,line_rates:[]});
export function toRate(terms:ToTerms,kind:string,label:string){return terms.line_rates.find(r=>r.line_kind===kind&&r.label.toLowerCase()===label.toLowerCase())?.rate??null;}
export function toBill(hours:number,rate:number|null,nonBillable=false){return nonBillable?0:rate===null?null:Math.round(hours*rate*100)/100;}
export function allowanceDays(days:{person:string;day:string;worked:boolean;nonBillable:boolean}[]){return new Set(days.filter(d=>d.worked&&!d.nonBillable).map(d=>`${d.person}:${d.day}`)).size;}
export function capMobilization(amount:number|null,cap:number|null){return amount===null?null:cap===null?amount:Math.min(amount,cap);}
export function deltaResult(current:number,delta:number){if(current+delta<0)throw new Error('Deduction exceeds authorization');return current+delta;}
export function activeLocationRecipient(a:{location_id:string;status:string;assigned_at:string;unassigned_at:string|null},location:string,at:number){return a.location_id===location&&a.status==='active'&&Date.parse(a.assigned_at)<=at&&(!a.unassigned_at||Date.parse(a.unassigned_at)>at);}