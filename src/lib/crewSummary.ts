/** Short role tag for the crew summary line. */
export function roleTag(role: string | null | undefined): string {
  const r = (role ?? '').trim();
  if (!r) return 'No role';
  if (/supervisor|lead|foreman/i.test(r)) return 'Sup';
  if (/technician|\btech\b/i.test(r)) return 'Tech';
  if (/operator/i.test(r)) return 'Op';
  return r;
}

/** "Mon 11/23 · 9 in / 20 · 4 Sup / 16 Tech" — counts only people on the roster that day; "in" counts anyone who worked. */
export function crewSummary(day: string, rows: { present: boolean; role: string | null; onRoster: boolean }[]): string {
  const d = new Date(`${day}T12:00:00Z`);
  const label = `${d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${day.slice(5, 7)}/${day.slice(8, 10)}`;
  const roster = rows.filter(r => r.onRoster);
  const counts = new Map<string, number>();
  for (const r of roster) counts.set(roleTag(r.role), (counts.get(roleTag(r.role)) ?? 0) + 1);
  const roles = [...counts.entries()].sort((a, b) => (a[0] === 'Sup' ? -1 : b[0] === 'Sup' ? 1 : b[1] - a[1])).map(([k, n]) => `${n} ${k}`);
  return [label, `${rows.filter(r => r.present).length} in / ${roster.length}`, ...(roles.length ? [roles.join(' / ')] : [])].join(' · ');
}
