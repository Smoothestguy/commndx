export type WorksFor = 'frg' | 'agency' | 'customer';

// Keep employer choices exclusive even when a stale form contains both IDs.
export function employerIds(customerId?: string | null, vendorId?: string | null) {
  return { employer_customer_id: customerId || null, vendor_id: customerId ? null : vendorId || null };
}

export function quickEmployer(mode: WorksFor, customerId: string, vendorId: string) {
  return employerIds(mode === 'customer' ? customerId : null, mode === 'agency' ? vendorId : null);
}

export function customerNonBillableDefault(mode: WorksFor, current: boolean) {
  return mode === 'customer' ? true : current;
}

export function projectEmployerMaps(data?: {
  people: { personnel_id: string; vendor_id: string | null; employer_customer_id?: string | null; non_billable: boolean }[];
  vendors: { id: string; name: string }[];
  customers?: { id: string; name: string }[];
}) {
  const people = data?.people || [];
  const vendorByPerson = Object.fromEntries(people.map(p => [p.personnel_id, p.employer_customer_id ? null : p.vendor_id]));
  const customerByPerson = Object.fromEntries(people.map(p => [p.personnel_id, p.employer_customer_id || null]));
  const nonBillableByPerson = Object.fromEntries(people.map(p => [p.personnel_id, p.non_billable]));
  const vendorIds = new Set(Object.values(vendorByPerson).filter(Boolean));
  const vendors = [...(data?.vendors || [])].filter(v => vendorIds.has(v.id)).sort((a, b) => a.name.localeCompare(b.name));
  const vendorNames = Object.fromEntries(vendors.map(v => [v.id, v.name]));
  const customerNames = Object.fromEntries((data?.customers || []).map(c => [c.id, c.name]));
  const agencyName = (personId: string) => vendorNames[vendorByPerson[personId] || ''];
  const employerName = (personId: string) => customerByPerson[personId]
    ? (customerNames[customerByPerson[personId]] ? `${customerNames[customerByPerson[personId]]} (customer)` : undefined)
    : agencyName(personId);
  return { vendorByPerson, customerByPerson, nonBillableByPerson, vendors, agencyName, employerName };
}