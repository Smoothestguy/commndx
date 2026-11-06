/** One entry per person: signed when any of their rows that day carries a signature. */
export function summarizeSignatures(rows: { personnelId: string; name: string; signature: string | null }[]) {
  const people = new Map<string, { personnelId: string; name: string; signed: boolean }>();
  for (const r of rows) { const p = people.get(r.personnelId) ?? { personnelId: r.personnelId, name: r.name, signed: false }; p.signed ||= !!r.signature; people.set(r.personnelId, p); }
  const all = [...people.values()];
  const missing = all.filter(p => !p.signed).sort((a, b) => a.name.localeCompare(b.name));
  return { total: all.length, signed: all.length - missing.length, missing };
}
