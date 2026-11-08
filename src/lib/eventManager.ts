import type { Database } from '@/integrations/supabase/types';
import { localDay, nextDay } from '@/lib/signinSheets';
import { locationTimeIso } from '@/lib/manualTime';
export type EventTable = 'event_locations'|'event_companies'|'event_company_personnel'|'event_bunks'|'event_bunk_assignments'|'event_meal_scans'|'event_laundry';
export type EventRow<T extends EventTable> = Database['public']['Tables'][T]['Row'];
export type CampData = { companies: EventRow<'event_companies'>[]; people: EventRow<'event_company_personnel'>[]; bunks: EventRow<'event_bunks'>[]; assignments: EventRow<'event_bunk_assignments'>[]; meals: EventRow<'event_meal_scans'>[]; laundry: EventRow<'event_laundry'>[] };
export function campCounts(data: CampData, day: string, zone: string) {
 const start=locationTimeIso(day,'00:00',zone), end=locationTimeIso(nextDay(day),'00:00',zone);
 if(!start||!end) throw new Error('Invalid report date');
 return data.companies.map(company=>{
  const ids=new Set(data.people.filter(p=>p.company_id===company.id).map(p=>p.id));
  const meals=data.meals.filter(m=>ids.has(m.person_id)&&m.service_date===day);
  return {Date:day, Company:company.name, 'Bunk heads':new Set(data.assignments.filter(a=>ids.has(a.person_id)&&a.checked_in_at<end&&(!a.checked_out_at||a.checked_out_at>start)).map(a=>a.person_id)).size, Breakfast:meals.filter(m=>m.meal_type==='breakfast').length, Lunch:meals.filter(m=>m.meal_type==='lunch').length, Dinner:meals.filter(m=>m.meal_type==='dinner').length, 'Laundry in':data.laundry.filter(l=>ids.has(l.person_id)&&localDay(l.checked_in_at,zone)===day).length, 'Laundry out':data.laundry.filter(l=>ids.has(l.person_id)&&l.checked_out_at&&localDay(l.checked_out_at,zone)===day).length};
 });
}
export function reportRange(data:CampData,from:string,to:string,zone:string,companyId='') {
 if(!from||!to||from>to) throw new Error('Choose a valid date range');
 const company=companyId?data.companies.find(c=>c.id===companyId):undefined;
 const rows: ReturnType<typeof campCounts> = [];
 for(let day=from,n=0;day<=to;day=nextDay(day),n++) {if(n>=366) throw new Error('Choose up to 366 days'); rows.push(...campCounts({...data,companies:company?[company]:data.companies},day,zone));}
 return rows;
}
export function pastedPeople(text:string) {return text.split(/\r?\n/).map(n=>n.trim()).filter(Boolean).map(n=>{const [first_name,...rest]=n.split(/\s+/);return {first_name,last_name:rest.join(' ')};});}
export function laundryAge(at:string, now=Date.now()) {return Math.max(0,Math.floor((now-Date.parse(at))/3600000));}
export const eventAccess=(roles:string[])=>roles.some(r=>r==='admin'||r==='manager');
