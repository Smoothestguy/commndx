import {dayAt,midnightAt,addDay} from './reconciliation.ts';
export function shiftAt(day:string,time:string,zone:string){const [h,m]=time.split(':').map(Number);const target=Date.parse(`${day}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`);let t=midnightAt(day,zone)+(h*60+m)*60000;for(let i=0;i<3;i++){const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t));const v=(k:string)=>p.find(x=>x.type===k)?.value;t+=target-Date.parse(`${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}:${v('second')}Z`);}return t;}
export function rosterThresholds(now:number,zone:string,dayStart:string,nightStart:string,inAt:string|null){const day=dayAt(new Date(now).toISOString(),zone),start=shiftAt(day,dayStart,zone);let end:number|null=null;if(inAt){const inDay=dayAt(inAt,zone);const ds=shiftAt(inDay,dayStart,zone),ns=shiftAt(inDay,nightStart,zone),at=Date.parse(inAt);end=at<ds?ds:at<ns?ns:shiftAt(addDay(inDay),dayStart,zone);}return {day,remind:now>=start+15*60000,supervisor:now>=start+30*60000,checkout:end!=null&&now>=end+30*60000};}
export function preshiftAt(now:number,zone:string,dayStart:string,nightStart:string){
 const day=dayAt(new Date(now).toISOString(),zone);
 for(const d of [day,addDay(day)])for(const time of [dayStart,nightStart]){const start=shiftAt(d,time,zone);if(now>=start-15*60000&&now<start)return {day:d,time:time.slice(0,5),start};}
 return null;
}
export function checkoutKind(now:number,regularDue:boolean,extension:{status:string;until_at:string}|null){
 if(extension?.status==='approved'&&Number.isFinite(Date.parse(extension.until_at)))return now>=Date.parse(extension.until_at)?'checkout-ext':null;
 return regularDue?'checkout':null;
}
