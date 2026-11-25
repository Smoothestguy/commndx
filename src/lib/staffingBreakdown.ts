export type StaffRow = { role: string; required: number; present: number; diff: number };
const UNASSIGNED = 'No role set';
/** Present minus required by role; labels match case-insensitively, unmatched labels stay separate rows. */
export function staffingBreakdown(reqs: { role_label: string | null; headcount_needed: number | null }[], people: { id: string; role: string | null; present: boolean }[]) {
  const map = new Map<string, { role: string; required: number; ids: Set<string> }>();
  const get = (label: string | null) => { const role = (label ?? '').trim() || UNASSIGNED; const k = role.toLowerCase(); const existing = map.get(k); if (existing) return existing; const row = { role, required: 0, ids: new Set<string>() }; map.set(k, row); return row; };
  for (const r of reqs) get(r.role_label).required += Number(r.headcount_needed) || 0;
  for (const p of people) if (p.present) get(p.role).ids.add(p.id);
  const rows: StaffRow[] = [...map.values()].map(v => ({ role: v.role, required: v.required, present: v.ids.size, diff: v.ids.size - v.required }));
  const total = rows.reduce((t, r) => ({ role: 'Total', required: t.required + r.required, present: t.present + r.present, diff: t.diff + r.diff }), { role: 'Total', required: 0, present: 0, diff: 0 });
  return { rows, total };
}

type Requirement = { role_label: string | null; headcount_needed: number | null };
type Person = { id: string; role: string | null; present: boolean };
type Expected = { supervisors: number; technicians: number; operators: number };
const buckets = [
  { key: 'supervisors', match: 'sup', label: 'Supervisor' },
  { key: 'technicians', match: 'tech', label: 'Technician' },
  { key: 'operators', match: 'oper', label: 'Operator' },
] as const;

/** Daily display only: site requirements take precedence; customer buckets aggregate matching roles once. */
export function dailyStaffingBreakdown(reqs: Requirement[], people: Person[], expected?: Expected | null) {
  const source: 'site' | 'customer' | null = reqs.length ? 'site' : expected && buckets.some(b => expected[b.key] > 0) ? 'customer' : null;
  const fallbackReqs = source === 'customer' && expected
    ? buckets.filter(b => expected[b.key] > 0).map(b => ({ role_label: b.label, headcount_needed: expected[b.key] })) : [];
  const mappedPeople = source === 'customer' ? people.map(p => ({ ...p, role: buckets.find(b => p.role?.toLowerCase().includes(b.match))?.label ?? p.role })) : people;
  const data = staffingBreakdown(reqs.length ? reqs : fallbackReqs, mappedPeople);
  return { ...data, source, hasRequired: source !== null && data.total.required > 0 };
}
export const fmtDiff = (n: number) => n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
