export type StaffRow = { role: string; required: number; present: number; diff: number };
const UNASSIGNED = 'Unassigned role';
/** Present minus required by role; labels match case-insensitively, unmatched labels stay separate rows. */
export function staffingBreakdown(reqs: { role_label: string | null; headcount_needed: number | null }[], people: { id: string; role: string | null; present: boolean }[]) {
  const map = new Map<string, { role: string; required: number; ids: Set<string> }>();
  const get = (label: string | null) => { const role = (label ?? '').trim() || UNASSIGNED; const k = role.toLowerCase(); if (!map.has(k)) map.set(k, { role, required: 0, ids: new Set() }); return map.get(k)!; };
  for (const r of reqs) get(r.role_label).required += Number(r.headcount_needed) || 0;
  for (const p of people) if (p.present) get(p.role).ids.add(p.id);
  const rows: StaffRow[] = [...map.values()].map(v => ({ role: v.role, required: v.required, present: v.ids.size, diff: v.ids.size - v.required }));
  const total = rows.reduce((t, r) => ({ role: 'Total', required: t.required + r.required, present: t.present + r.present, diff: t.diff + r.diff }), { role: 'Total', required: 0, present: 0, diff: 0 });
  return { rows, total };
}
export const fmtDiff = (n: number) => n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
