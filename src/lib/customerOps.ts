// Pure helpers for the Customer Ops workspace. Output is hours-only: no rate or dollar fields exist here.
export type AttendanceRow = { visit_personnel_id: string; personnel_id: string; first_name: string; last_name: string; local_day: string; in_at: string | null; out_at: string | null; hours: number | null; signed: boolean };

const hm = (iso: string | null, tz: string) => iso ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)) : "";
const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export const ATTENDANCE_CSV_HEADERS = ["Date", "Name", "Time In", "Time Out", "Hours", "Signed"];

export function buildAttendanceCsv(rows: AttendanceRow[], tz: string): string {
  const sorted = [...rows].sort((a, b) => a.local_day.localeCompare(b.local_day) || `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`));
  return [ATTENDANCE_CSV_HEADERS, ...sorted.map(r => [r.local_day, `${r.first_name} ${r.last_name}`, hm(r.in_at, tz), hm(r.out_at, tz), r.hours ?? "", r.signed ? "Yes" : "No"])]
    .map(line => line.map(cell).join(",")).join("\n");
}

/** A local day counts as signed when ANY stay that day is signed (first signed stay per day is preserved). */
export function missingByPerson(rows: AttendanceRow[]) {
  const byKey = new Map<string, { signed: boolean; row: AttendanceRow }>();
  for (const r of rows) { const k = `${r.personnel_id}|${r.local_day}`; const prev = byKey.get(k); byKey.set(k, { signed: (prev?.signed ?? false) || r.signed, row: r }); }
  const people = new Map<string, { personnel_id: string; name: string; dates: string[] }>();
  for (const { signed, row } of byKey.values()) {
    if (signed) continue;
    const p = people.get(row.personnel_id) ?? { personnel_id: row.personnel_id, name: `${row.first_name} ${row.last_name}`, dates: [] };
    p.dates.push(row.local_day); people.set(row.personnel_id, p);
  }
  return [...people.values()].map(p => ({ ...p, dates: p.dates.sort() })).sort((a, b) => a.name.localeCompare(b.name));
}
