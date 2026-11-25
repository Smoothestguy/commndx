// One eligibility gate for every automatic sign-in text (roster-alerts, scheduledClose, check-stale-clocks).
// Pure core + batched loader. No Deno/npm imports so the browser (manual-send warnings) and bun tests reuse it.
export const AUTO_TEXT_TYPES = [
  { key: 'preshift', label: 'Pre-shift reminder', kinds: ['preshift'] },
  { key: 'no_show', label: "No clock-in reminder (\u201cYou're expected at\u2026\u201d)", kinds: ['no_show'] },
  { key: 'checkout', label: 'Forgot to check out', kinds: ['checkout%'] },
  { key: 'auto_close', label: 'Auto clock-out notice', kinds: ['scheduled-auto-close%'] },
] as const;
export type AutoTextType = typeof AUTO_TEXT_TYPES[number]['key'];
export type Override = 'inherit' | 'on' | 'off';
export type AutoTextSettings = { paused: boolean; types: Record<AutoTextType, boolean>; locations: Record<string, Partial<Record<AutoTextType, Override>>> };
export const AUTO_TEXT_SETTING_KEY = 'auto_sign_in_texts';
const typeKeys = AUTO_TEXT_TYPES.map(t => t.key) as AutoTextType[];

/** Missing/invalid values fall back to current behavior: everything on, not paused. */
export function parseAutoTextSettings(raw: unknown): AutoTextSettings {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, any> : {};
  const t = o.types && typeof o.types === 'object' ? o.types : {};
  const locations: AutoTextSettings['locations'] = {};
  if (o.locations && typeof o.locations === 'object') for (const [id, v] of Object.entries(o.locations as Record<string, any>)) {
    if (!v || typeof v !== 'object') continue;
    const row: Partial<Record<AutoTextType, Override>> = {};
    for (const k of typeKeys) if (v[k] === 'on' || v[k] === 'off') row[k] = v[k];
    if (Object.keys(row).length) locations[id] = row;
  }
  return { paused: o.paused === true, types: Object.fromEntries(typeKeys.map(k => [k, t[k] !== false])) as Record<AutoTextType, boolean>, locations };
}
export function kindToType(kind: string): AutoTextType | null {
  if (kind === 'preshift') return 'preshift';
  if (kind === 'no_show') return 'no_show';
  if (kind.startsWith('checkout')) return 'checkout';
  if (kind.startsWith('scheduled-auto-close')) return 'auto_close';
  return null;
}
/** Master pause beats everything; a location On/Off override beats the global switch. */
export function typeEnabled(s: AutoTextSettings, type: AutoTextType, locationId: string) {
  if (s.paused) return false;
  const o = s.locations[locationId]?.[type];
  return o === 'on' ? true : o === 'off' ? false : s.types[type];
}

export type EligibilityInput = {
  now: number; day: string; // location-local YYYY-MM-DD
  location: { status: string | null; mobe_date?: string | null; demobe_date?: string | null } | null;
  project: { status: string | null; stage?: string | null; deleted_at?: string | null } | null;
  assignment: { status: string | null; assigned_at: string | null; unassigned_at: string | null } | null;
  person: { status: string | null; do_not_rehire?: boolean | null; deleted_at?: string | null } | null;
  latestStatus: { status: string; project_id: string | null } | null; projectId: string;
  optedOut: boolean;
};
const CLOSED_STAGES = new Set(['complete', 'canceled', 'cancelled', 'archived', 'closed']);
/** Returns null when the person may be auto-texted, else a short reason. */
export function ineligibleReason(i: EligibilityInput): string | null {
  if (!i.location || i.location.status !== 'active') return 'site not active';
  if (!i.project || i.project.status !== 'active' || i.project.deleted_at || (i.project.stage && CLOSED_STAGES.has(i.project.stage))) return 'project not active';
  if (i.location.mobe_date && i.day < i.location.mobe_date) return 'before mobilization';
  if (i.location.demobe_date && i.day > i.location.demobe_date) return 'after demobilization date';
  const a = i.assignment;
  if (!a || a.status !== 'active') return 'unassigned';
  if (a.unassigned_at && Date.parse(a.unassigned_at) <= i.now) return 'unassigned';
  if (!a.assigned_at || Date.parse(a.assigned_at) > i.now) return 'not yet assigned';
  if (i.latestStatus?.status === 'demobilized' && (!i.latestStatus.project_id || i.latestStatus.project_id === i.projectId)) return 'demobilized';
  if (!i.person || i.person.deleted_at || i.person.status !== 'active') return 'person not active';
  if (i.person.do_not_rehire) return 'do not rehire';
  if (i.optedOut) return 'opted out of texts';
  return null;
}

const localDay = (now: number, zone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
async function chunked(ids: string[], run: (part: string[]) => PromiseLike<{ data: any[] | null; error: any }>) {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 200) { const { data, error } = await run(ids.slice(i, i + 200)); if (error) throw error; out.push(...(data || [])); }
  return out;
}
export type AutoTextContext = Awaited<ReturnType<typeof loadAutoTextContext>>;
/** One batched read for every location/person a sender is about to consider. */
// deno-lint-ignore no-explicit-any
export async function loadAutoTextContext(db: any, locationIds: string[], personnelIds: string[]) {
  const lids = [...new Set(locationIds)], pids = [...new Set(personnelIds)];
  const setting = await db.from('integration_settings').select('setting_value').eq('setting_key', AUTO_TEXT_SETTING_KEY).maybeSingle();
  if (setting.error) throw setting.error;
  const locations = await chunked(lids, p => db.from('project_locations').select('id,project_id,status,mobe_date,demobe_date,timezone').in('id', p));
  const projectIds = [...new Set(locations.map(l => l.project_id).filter(Boolean))] as string[];
  const [projects, assignments, people, statuses] = await Promise.all([
    chunked(projectIds, p => db.from('projects').select('id,status,stage,deleted_at,timezone').in('id', p)),
    chunked(pids, p => db.from('location_assignments').select('personnel_id,location_id,status,assigned_at,unassigned_at').in('personnel_id', p).in('location_id', lids.length ? lids : ['00000000-0000-0000-0000-000000000000'])),
    chunked(pids, p => db.from('personnel').select('id,status,do_not_rehire,deleted_at,applicant_id').in('id', p)),
    chunked(pids, p => db.from('personnel_status_log').select('personnel_id,status,project_id,effective_at').in('personnel_id', p).order('effective_at', { ascending: false })),
  ]);
  const applicantIds = people.map(p => p.applicant_id).filter(Boolean) as string[];
  const applicants = await chunked(applicantIds, p => db.from('applicants').select('id,sms_opted_out').in('id', p));
  const latest = new Map<string, { status: string; project_id: string | null }>();
  for (const s of statuses) if (!latest.has(s.personnel_id)) latest.set(s.personnel_id, s);
  const opted = new Set(applicants.filter(a => a.sms_opted_out).map(a => a.id));
  return {
    settings: parseAutoTextSettings(setting.data?.setting_value),
    locations: new Map(locations.map(l => [l.id, l])), projects: new Map(projects.map(p => [p.id, p])),
    assignments, people: new Map(people.map(p => [p.id, p])), latest, opted,
  };
}
/** Best active assignment row (an active one beats ended history rows). */
function pickAssignment(ctx: AutoTextContext, personnelId: string, locationId: string, now: number) {
  const rows = ctx.assignments.filter(a => a.personnel_id === personnelId && a.location_id === locationId);
  return rows.find(a => a.status === 'active' && (!a.unassigned_at || Date.parse(a.unassigned_at) > now)) || rows.find(a => a.status === 'active') || rows[0] || null;
}
export function checkEligibility(ctx: AutoTextContext, personnelId: string, locationId: string, now = Date.now()) {
  const l = ctx.locations.get(locationId), p = l ? ctx.projects.get(l.project_id) : null, person = ctx.people.get(personnelId);
  return ineligibleReason({
    now, day: localDay(now, l?.timezone || p?.timezone || 'America/Chicago'), location: l || null, project: p || null,
    assignment: pickAssignment(ctx, personnelId, locationId, now), person: person || null,
    latestStatus: ctx.latest.get(personnelId) || null, projectId: l?.project_id || '', optedOut: !!(person?.applicant_id && ctx.opted.has(person.applicant_id)),
  });
}
/** Automatic senders: settings first ('disabled'), then the hard rules. */
export function autoTextDecision(ctx: AutoTextContext, kind: string, personnelId: string, locationId: string, now = Date.now()): { send: true } | { send: false; reason: string; disabled: boolean } {
  const type = kindToType(kind);
  if (type && !typeEnabled(ctx.settings, type, locationId)) return { send: false, reason: 'disabled', disabled: true };
  const r = checkEligibility(ctx, personnelId, locationId, now);
  return r ? { send: false, reason: r, disabled: false } : { send: true };
}
