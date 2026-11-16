export type EventLocation = { project_id: string; customer_id?: string | null; status: string };
export function eventCustomers(locations: EventLocation[], legacy?: string | null) {
  const counts = new Map<string, number>();
  for (const l of locations) { const id = l.customer_id || legacy; if (id) counts.set(id, (counts.get(id) || 0) + 1); }
  return [...counts].map(([id, count]) => ({ id, count }));
}
export function locationCustomer(location?: {customer_id?: string|null}, legacy?: string|null) { return location?.customer_id || legacy || null; }
export function locationStatusCounts(locations: {status:string}[]) { return locations.reduce<Record<string,number>>((out,l)=>{out[l.status]=(out[l.status]||0)+1;return out;},{}); }
/** Customer → project ids derived from locations; project customer is a legacy fallback only for locations with no customer. */
export function customerProjectMap(locations: {project_id:string;customer_id?:string|null}[], projects: {id:string;customer_id?:string|null}[]) {
  const legacy = new Map(projects.map(p => [p.id, p.customer_id || null]));
  const out = new Map<string, Set<string>>();
  for (const l of locations) { const id = l.customer_id || legacy.get(l.project_id); if (!id) continue; if (!out.has(id)) out.set(id, new Set()); out.get(id)!.add(l.project_id); }
  return out;
}
