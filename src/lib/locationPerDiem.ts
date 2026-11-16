export type LocationPerDiem = {per_diem_days?:number|null;per_diem_day_rate?:number|null;per_diem_headcount?:number|null;per_diem_notes?:string|null};
export function validPerDiemDays(n:number){return Number.isFinite(n)&&n>=0&&n<=365&&Number.isInteger(n*2);}
export function billableSignedHeadcount(stays:{personnel_id:string;in_at:string;out_at:string|null;signed_at:string|null;signature_url:string|null;non_billable:boolean}[]){
 return new Set(stays.filter(s=>!s.non_billable&&s.signed_at&&s.signature_url&&s.out_at&&Date.parse(s.out_at)>Date.parse(s.in_at)).map(s=>s.personnel_id)).size;
}
export function perDiemText(l:LocationPerDiem,showMoney:boolean,autoCount?:number,compact=false){
 const d=l.per_diem_days;if(d==null)return compact?'Not set':'';
 const days=d===0.5?'½ day':`${d} ${d===1?'day':'days'}`;
 if(!showMoney)return compact?days:`Per diem: ${days}`;
 const rate=l.per_diem_day_rate;
 const money=(n:number)=>`$${n.toLocaleString('en-US',{maximumFractionDigits:2})}`;
 if(rate==null)return `${compact?'':'Per diem: '}${days} · no rate`;
 const person=d*rate,headcount=l.per_diem_headcount??autoCount;
 if(compact)return `${days} · ${money(person)}/person${headcount==null?' · count pending':` · ${headcount} ${headcount===1?'person':'people'}${l.per_diem_headcount==null?' (auto)':''}`}`;
 return `Per diem: ${days} × ${money(rate)} = ${money(person)}/person${headcount==null?'':` · ${headcount} ${headcount===1?'person':'people'} = ${money(person*headcount)}`}`;
}