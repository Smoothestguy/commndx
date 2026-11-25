import { localDay } from '@/lib/signinSheets';
import { isShortStay, pickExpected, overlappingStays, dailyStaffingBreakdown, type ExpectedRow } from '@/lib/staffingBreakdown';
import { needActionIds } from '@/lib/needAction';

export type TodayLocation = { id: string; name: string; project_id: string; timezone: string | null; mobe_date?: string | null; demobe_date?: string | null };
export type TodayStay = { visit_personnel_id: string; personnel_id: string | null; location_id: string | null; location_name?: string | null; first_name?: string | null; last_name?: string | null; in_at: string | null; out_at: string | null; signature_url?: string | null };
export type TodayInput = {
  locations: TodayLocation[]; projects: { id: string; name: string }[]; now?: number;
  trail: TodayStay[]; roster: { location_id: string; personnel_id: string }[];
  resolutions: { location_id: string; personnel_id: string; day: string }[];
  presence: { location_id: string; personnel_id: string; sign_date: string }[];
  requirements: { location_id: string; role_label: string | null; headcount_needed: number | null }[];
  expected: (ExpectedRow & { location_id: string })[];
};
export type SiteCard = { id: string; name: string; projectId: string; projectBadge: string; day: string; zone: string; onSheet: number; required: number | null; needAction: number; missingSignatures: number; openPunches: number; overlaps: number; problems: number };
export type Attention = { key: string; kind: 'stale_open' | 'overlap' | 'no_clockin' | 'onboarding'; text: string; detail: string; to: string };

/** Event number for badges: 4-digit code from project, else location name, else short project name. */
export function projectBadge(project: string, location = '') {
  const code = (s: string) => s.match(/\b[A-Za-z]{1,4}\s*-\s*(\d{4})\b/)?.[1] ?? s.match(/\b(\d{4})\b/)?.[1];
  return code(project) ?? code(location) ?? (project.length > 14 ? `${project.slice(0, 13)}…` : project);
}
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
const nameOf = (s: { first_name?: string | null; last_name?: string | null }) => [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Unnamed';
export const crewDayPath = (l: { id: string; project_id: string }) => `/projects/${l.project_id}/locations/${l.id}?tab=crew&view=day`;

/** Per-site Today summary using the Crew day rules: location-local day, stays ≥5 min count, carry-forward requirements. */
export function todaySites(i: TodayInput) {
  const now = i.now ?? Date.now(), iso = new Date(now).toISOString();
  const attention: Attention[] = [];
  const overlapSeen = new Set<string>();
  const cards: SiteCard[] = [];
  for (const l of i.locations) {
    const zone = l.timezone || 'America/Chicago', day = localDay(iso, zone);
    const here = i.trail.filter(t => t.location_id === l.id && t.in_at && t.personnel_id);
    const today = here.filter(t => localDay(t.in_at as string, zone) === day);
    const counted = today.filter(t => !isShortStay({ in_at: t.in_at as string, out_at: t.out_at }));
    const onSheet = [...new Set(counted.map(t => t.personnel_id as string))];
    const rosterIds = i.roster.filter(r => r.location_id === l.id).map(r => r.personnel_id);
    if (!rosterIds.length && !today.length) continue;
    const need = needActionIds(rosterIds, today.map(t => t.personnel_id as string), i.resolutions.filter(r => r.location_id === l.id && r.day === day).map(r => r.personnel_id));
    const presence = new Set(i.presence.filter(p => p.location_id === l.id && p.sign_date === day).map(p => p.personnel_id));
    const missing = onSheet.filter(id => !presence.has(id) && !today.some(t => t.personnel_id === id && t.signature_url));
    const open = here.filter(t => !t.out_at);
    for (const s of open) if (localDay(s.in_at as string, zone) < day) attention.push({ key: `open:${s.visit_personnel_id}`, kind: 'stale_open', text: `${nameOf(s)} still clocked in`, detail: `Since ${localDay(s.in_at as string, zone).slice(5).replace('-', '/')} · ${l.name}`, to: crewDayPath(l) });
    let overlaps = 0;
    for (const id of onSheet) {
      const mine = counted.filter(t => t.personnel_id === id).map(t => ({ in_at: t.in_at as string, out_at: t.out_at }));
      const others = i.trail.filter(t => t.personnel_id === id && t.location_id !== l.id && t.in_at).map(t => ({ ...t, in_at: t.in_at as string }));
      const hits = overlappingStays(mine, others, now); if (!hits.length) continue;
      overlaps++;
      const pairKey = [id, ...[l.id, hits[0].location_id].sort()].join(':');
      if (!overlapSeen.has(pairKey)) { overlapSeen.add(pairKey); const p = counted.find(t => t.personnel_id === id)!; attention.push({ key: `overlap:${pairKey}`, kind: 'overlap', text: `${nameOf(p)} counted at 2 sites`, detail: `${l.name} + ${hits[0].location_name || 'another site'}`, to: crewDayPath(l) }); }
    }
    const reqs = i.requirements.filter(r => r.location_id === l.id);
    const exp = pickExpected(i.expected.filter(e => e.location_id === l.id), day, { start: l.mobe_date ?? null, end: l.demobe_date ?? null });
    const staffing = dailyStaffingBreakdown(reqs, [], exp);
    const project = i.projects.find(p => p.id === l.project_id)?.name ?? '';
    const card = { id: l.id, name: l.name, projectId: l.project_id, projectBadge: projectBadge(project, l.name), day, zone, onSheet: onSheet.length, required: staffing.hasRequired ? staffing.total.required : null, needAction: need.length, missingSignatures: missing.length, openPunches: new Set(open.map(t => t.personnel_id)).size, overlaps, problems: 0 };
    card.problems = card.needAction + card.missingSignatures + card.openPunches + card.overlaps;
    cards.push(card);
  }
  cards.sort((a, b) => b.problems - a.problems || a.name.localeCompare(b.name));
  return { cards, attention, onSheet: cards.reduce((n, c) => n + c.onSheet, 0) };
}

/** Roster people whose latest clock-in anywhere is 2+ days before the site's local today (or none in the lookback). */
export function noRecentClockIns(locations: TodayLocation[], roster: { location_id: string; personnel_id: string; assigned_at?: string | null }[], trail: TodayStay[], names: Record<string, string>, now = Date.now()): Attention[] {
  const out: Attention[] = [], seen = new Set<string>();
  for (const r of roster) {
    if (seen.has(r.personnel_id)) continue;
    const l = locations.find(x => x.id === r.location_id); if (!l) continue;
    const zone = l.timezone || 'America/Chicago', day = localDay(new Date(now).toISOString(), zone);
    const last = trail.filter(t => t.personnel_id === r.personnel_id && t.in_at).map(t => localDay(t.in_at as string, zone)).sort().at(-1);
    const since = last ?? (r.assigned_at ? localDay(r.assigned_at, zone) : null);
    if (!since || dayDiff(since, day) < 2) continue;
    seen.add(r.personnel_id);
    out.push({ key: `idle:${r.personnel_id}`, kind: 'no_clockin', text: `${names[r.personnel_id] || 'Roster member'} — no clock-in ${dayDiff(since, day)}+ days`, detail: last ? `Last ${last.slice(5).replace('-', '/')} · ${l.name}` : `None since assigned · ${l.name}`, to: crewDayPath(l) });
  }
  return out;
}
