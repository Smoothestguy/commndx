export function rosterContains(rows: { id: string }[] = [], id: string) { return rows.some(row => row.id === id); }
export function rosterChoices<T extends { personnel_id: string }>(rows: T[], members: { id: string }[], workedIds: string[] = []) {
  const eligible = new Set([...members.map(p => p.id), ...workedIds]);
  return rows.filter(row => eligible.has(row.personnel_id));
}