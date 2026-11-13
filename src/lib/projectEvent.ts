export type EventLocation = { project_id: string; customer_id?: string | null; status: string };
export function eventCustomers(locations: EventLocation[], legacy?: string | null) {
  const counts = new Map<string, number>();
  for (const l of locations) { const id = l.customer_id || legacy; if (id) counts.set(id, (counts.get(id) || 0) + 1); }
  if (!locations.length && legacy) counts.set(legacy, 0);
  return [...counts].map(([id, count]) => ({ id, count }));
}
export function locationCustomer(location?: {customer_id?: string|null}, legacy?: string|null) { return location?.customer_id || legacy || null; }
export function locationStatusCounts(locations: {status:string}[]) { return locations.reduce<Record<string,number>>((out,l)=>{out[l.status]=(out[l.status]||0)+1;return out;},{}); }
