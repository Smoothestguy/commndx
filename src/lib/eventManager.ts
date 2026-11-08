import type { Database } from '@/integrations/supabase/types';
import { localDay, nextDay } from '@/lib/signinSheets';
import { locationTimeIso } from '@/lib/manualTime';
export type EventTable = 'event_locations'|'event_companies'|'event_company_personnel'|'event_bunks'|'event_bunk_assignments'|'event_meal_scans'|'event_laundry'|'event_task_orders';
export type EventRow<T extends EventTable> = Database['public']['Tables'][T]['Row'];
export type CampData = { companies: EventRow<'event_companies'>[]; people: EventRow<'event_company_personnel'>[]; bunks: EventRow<'event_bunks'>[]; assignments: EventRow<'event_bunk_assignments'>[]; meals: EventRow<'event_meal_scans'>[]; laundry: EventRow<'event_laundry'>[]; orders?: EventRow<'event_task_orders'>[] };
export type AuthorizationLine = {label:string;qty_delta:number};
export function authorizationLines(value:unknown):AuthorizationLine[] {
 if(!Array.isArray(value))return [];
 return value.flatMap(line=>line&&typeof line==='object'&&typeof line.label==='string'&&typeof line.qty_delta==='number'&&Number.isFinite(line.qty_delta)?[{label:line.label,qty_delta:line.qty_delta}]:[]);
}
export function authorizedLevel(orders:NonNullable<CampData['orders']>,day:string,companyId:string|null,label='Pax') {
 return Math.max(0,orders.filter(o=>o.effective_date<=day&&o.company_id===companyId).reduce((sum,o)=>sum+authorizationLines(o.lines).filter(l=>l.label.trim().toLowerCase()===label.trim().toLowerCase()).reduce((n,l)=>n+l.qty_delta,0),0));
}
export function locationAuthorized(orders:NonNullable<CampData['orders']>,day:string) {
 const scopes=new Set<string|null>(orders.map(o=>o.company_id));
 return [...scopes].reduce((sum,scope)=>sum+authorizedLevel(orders,day,scope),0);
}
export function campCounts(data: CampData, day: string, zone: string) {
 const start=locationTimeIso(day,'00:00',zone), end=locationTimeIso(nextDay(day),'00:00',zone);
 if(!start||!end) throw new Error('Invalid report date');
 return data.companies.map(company=>{
  const ids=new Set(data.people.filter(p=>p.company_id===company.id).map(p=>p.id));
  const meals=data.meals.filter(m=>ids.has(m.person_id)&&m.service_date===day);
  const heads=new Set(data.assignments.filter(a=>ids.has(a.person_id)&&a.checked_in_at<end&&(!a.checked_out_at||a.checked_out_at>start)).map(a=>a.person_id)).size;
  const scoped=(data.orders??[]).some(o=>o.company_id===company.id&&o.effective_date<=day);
  const pax=scoped?authorizedLevel(data.orders??[],day,company.id):null;
  return {Date:day, Company:company.name, 'Authorized Pax':pax, 'Bunk heads':heads, 'Over / under':pax===null?null:heads-pax, Breakfast:meals.filter(m=>m.meal_type==='breakfast').length, Lunch:meals.filter(m=>m.meal_type==='lunch').length, Dinner:meals.filter(m=>m.meal_type==='dinner').length, 'Laundry in':data.laundry.filter(l=>ids.has(l.person_id)&&localDay(l.checked_in_at,zone)===day).length, 'Laundry out':data.laundry.filter(l=>ids.has(l.person_id)&&l.checked_out_at&&localDay(l.checked_out_at,zone)===day).length};
 });
}
export function reportRange(data:CampData,from:string,to:string,zone:string,companyId='') {
 if(!from||!to||from>to) throw new Error('Choose a valid date range');
 const company=companyId?data.companies.find(c=>c.id===companyId):undefined;
 const rows: ReturnType<typeof campCounts> = [];
 for(let day=from,n=0;day<=to;day=nextDay(day),n++) {if(n>=366) throw new Error('Choose up to 366 days'); const all=campCounts(data,day,zone);rows.push(...(company?all.filter(r=>r.Company===company.name):all));const pax=locationAuthorized(data.orders??[],day),heads=all.reduce((n,r)=>n+r['Bunk heads'],0);rows.push({Date:day,Company:'Location total','Authorized Pax':pax,'Bunk heads':heads,'Over / under':heads-pax,Breakfast:all.reduce((n,r)=>n+r.Breakfast,0),Lunch:all.reduce((n,r)=>n+r.Lunch,0),Dinner:all.reduce((n,r)=>n+r.Dinner,0),'Laundry in':all.reduce((n,r)=>n+r['Laundry in'],0),'Laundry out':all.reduce((n,r)=>n+r['Laundry out'],0)});}
 return rows;
}
export function pastedPeople(text:string) {return text.split(/\r?\n/).map(n=>n.trim()).filter(Boolean).map(n=>{const [first_name,...rest]=n.split(/\s+/);return {first_name,last_name:rest.join(' ')};});}
export function laundryAge(at:string, now=Date.now()) {return Math.max(0,Math.floor((now-Date.parse(at))/3600000));}
export const eventAccess=(roles:string[])=>roles.some(r=>r==='admin'||r==='manager');
