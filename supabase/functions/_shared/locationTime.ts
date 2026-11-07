export function locationZone(location: {timezone?: string | null}, project?: {timezone?: string | null}) {
  return location.timezone || project?.timezone || 'America/Chicago';
}
export function zoneLabel(zone: string, at: string | number) {
  const long = new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'long'}).formatToParts(new Date(at)).find(p=>p.type==='timeZoneName')?.value || zone;
  return long.replace(/ (Standard|Daylight) Time$/, '');
}
export function localStamp(at: string | number, zone: string) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at));
  const v=(k:string)=>parts.find(p=>p.type===k)?.value;
  return `${v('year')}-${v('month')}-${v('day')} ${v('hour')}${v('minute')} ${zoneLabel(zone,at)} (${zone})`;
}
export function preshiftMessage(time:string,zone:string,start:number,name:string,link:string) {
  return `FRG: Clock in for your ${time.slice(0,5).replace(':','')} ${zoneLabel(zone,start)} shift at ${name}: ${link}`;
}