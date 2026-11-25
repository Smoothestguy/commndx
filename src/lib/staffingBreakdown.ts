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

/** Stays under five minutes (e.g. accidental double taps) are shown but never counted as present. */
export const SHORT_STAY_MS = 5 * 60 * 1000;
export const isShortStay = (s: { in_at: string; out_at: string | null }) => !!s.out_at && Date.parse(s.out_at) - Date.parse(s.in_at) < SHORT_STAY_MS;

export type ExpectedRow = Expected & { day: string };
/** Customer-sheet carry-forward: exact day, else latest earlier row; only within the location's active window when set. */
export function pickExpected<T extends ExpectedRow>(rows: T[], day: string, window?: { start?: string | null; end?: string | null }): T | null {
  const exact = rows.find(r => r.day === day);
  if (exact) return exact;
  if (window?.start && day < window.start) return null;
  if (window?.end && day > window.end) return null;
  return rows.filter(r => r.day < day && (!window?.start || r.day >= window.start)).sort((a, b) => b.day.localeCompare(a.day))[0] ?? null;
}

/** Roster role for the day, else most recent non-null role from any assignment, else null. */
export function resolveRole(rosterRole: string | null | undefined, history: { role_label: string | null; assigned_at: string }[]) {
  if (rosterRole?.trim()) return rosterRole;
  return [...history].filter(h => h.role_label?.trim()).sort((a, b) => b.assigned_at.localeCompare(a.assigned_at))[0]?.role_label ?? null;
}

export const OVERLAP_MIN_MS = 15 * 60 * 1000;
type Span = { in_at: string; out_at: string | null };
const spanEnd = (s: Span, now: number) => s.out_at ? Date.parse(s.out_at) : now;
/** Other-site stays overlapping any of these stays by more than 15 minutes; back-to-back never counts. */
export function overlappingStays<T extends Span>(mine: Span[], others: T[], now = Date.now()) {
  return others.filter(o => mine.some(m => Math.min(spanEnd(m, now), spanEnd(o, now)) - Math.max(Date.parse(m.in_at), Date.parse(o.in_at)) > OVERLAP_MIN_MS));
}
