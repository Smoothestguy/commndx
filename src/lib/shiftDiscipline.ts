export type EarlyRejection = { reason: string; shift_start?: string; early_minutes?: number };
export const EARLY_REASONS = ['Supervisor asked', 'Prep work', 'Ride arrived early', 'Other'];
export const EXTENSION_REASONS = ['Finishing task', 'Customer request', 'Waiting on relief', 'Other'];
export function extensionChoices(now = Date.now(), shiftEnd?: string | null) {
  const step = 15 * 60_000;
  const limit = Math.min(now + 6 * 3600_000, shiftEnd ? Date.parse(shiftEnd) + 6 * 3600_000 : Infinity);
  const choices: string[] = [];
  for (let t = Math.floor(now / step) * step + step; t <= limit; t += step) choices.push(new Date(t).toISOString());
  return choices;
}
export function earlyApproval(reason?: string | null, by?: string | null, at?: string | null) {
  return reason ? (by && at ? 'approved' : 'pending supervisor approval') : null;
}
export function earlyMinutes(at: string, zone: string, day: string, night: string) {
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at));
 const n=(key:string)=>Number(parts.find(p=>p.type===key)?.value||0),minute=n('hour')*60+n('minute')+n('second')/60;
 const minutes=(time:string)=>{const [h,m]=time.split(':').map(Number);return h*60+m;};
 const d=minutes(day),s=minutes(night);
 const gap=minute<d?d-minute:minute<s?s-minute:1440+d-minute;
 return gap>0?Math.round(gap):0;
}