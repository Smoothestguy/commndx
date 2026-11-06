export type LateInfo = { late_minutes?: number | null; late_reason?: string | null };
export function maxLate(rows: LateInfo[]): LateInfo {
  return rows.reduce<LateInfo>((best, row) => (row.late_minutes ?? 0) > (best.late_minutes ?? 0) ? row : best, {});
}
export function lateDayKey(person: string, date: string, location?: string) { return `${person}|${date}${location ? `|${location}` : ''}`; }