export function normalizeProjectStage(stage: string) { return stage === 'quote' ? 'standby' : stage; }
export function projectWriteFields<T extends object>(value: T) {
  const { customer_id, customer_po, ...fields } = value as T & { customer_id?: unknown; customer_po?: unknown };
  return fields;
}
export function entryCustomer(entry: { location_id?: string | null; location?: { customer_id?: string | null; customers?: { name: string } | null } | null; projects?: { customer_id?: string | null; customers?: { name: string } | null } | null }) {
  if (entry.location_id && !entry.location) return { id: null, customer: null };
  return entry.location?.customer_id
    ? { id: entry.location.customer_id, customer: entry.location.customers ?? null }
    : { id: entry.projects?.customer_id ?? null, customer: entry.projects?.customers ?? null };
}
