// Pure rules for the Event overview: people on site now, week KPI de-dupe, vendor grouping.
export const OPEN_STAY_MAX_HOURS = 18;
export const MIN_STAY_MINUTES = 5;
const H = 3600000;

export type OpenStay = { visit_personnel_id: string; personnel_id: string | null; name: string; location_id: string | null; in_at: string; out_at: string | null; auto_closed_at?: string | null };
export const localDay = (t: number, zone: string | null | undefined) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: zone || 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));

/** On site now = open stay (no out, not auto-closed) that started within the last 18h. Older open stays are stale. */
export function onSiteNow(stays: OpenStay[], zones: Record<string, string | null | undefined>, now: number) {
  const current: OpenStay[] = [], stale: OpenStay[] = [], today = new Set<string>();
  for (const s of stays) {
    const t = Date.parse(s.in_at); if (!Number.isFinite(t)) continue;
    const zone = zones[s.location_id || ''];
    if (s.personnel_id && localDay(t, zone) === localDay(now, zone)) today.add(s.personnel_id);
    if (s.out_at || s.auto_closed_at) continue;
    if (t <= now && now - t <= OPEN_STAY_MAX_HOURS * H) current.push(s); else if (t < now) stale.push(s);
  }
  const seen = new Set<string>(), people: OpenStay[] = [];
  for (const s of [...current].sort((a, b) => a.in_at.localeCompare(b.in_at))) { const k = s.personnel_id || s.visit_personnel_id; if (!seen.has(k)) { seen.add(k); people.push(s); } }
  const bySite: Record<string, number> = {};
  for (const s of people) bySite[s.location_id || ''] = (bySite[s.location_id || ''] || 0) + 1;
  return { count: people.length, people, bySite, stale, clockedInToday: today.size };
}

export type WeekEntry = { id: string; personnel_id: string | null; location_id: string | null; entry_date: string; hours: number; billable?: boolean | null; in_at?: string | null; out_at?: string | null };
export type DedupedEntry = WeekEntry & { effHours: number; overlapHours: number };

/** Crew-view rules: drop timed stays under 5 min; a person's overlapping timed stays count once (later stay loses the overlap). Hours-only rows are kept as-is. */
export function dedupeWeekEntries(entries: WeekEntry[]) {
  const out: DedupedEntry[] = [], shortExcluded: WeekEntry[] = [];
  const byPerson = new Map<string, WeekEntry[]>();
  for (const e of entries) {
    const a = e.in_at ? Date.parse(e.in_at) : NaN, b = e.out_at ? Date.parse(e.out_at) : NaN;
    if (Number.isFinite(a) && Number.isFinite(b) && b - a < MIN_STAY_MINUTES * 60000) { shortExcluded.push(e); continue; }
    if (Number.isFinite(a) && Number.isFinite(b) && e.personnel_id) { const l = byPerson.get(e.personnel_id) || []; l.push(e); byPerson.set(e.personnel_id, l); }
    else out.push({ ...e, effHours: Number(e.hours) || 0, overlapHours: 0 });
  }
  const overlapPeople = new Set<string>();
  for (const [pid, rows] of byPerson) {
    rows.sort((x, y) => Date.parse(x.in_at!) - Date.parse(y.in_at!));
    let coveredEnd = -Infinity;
    for (const e of rows) {
      const a = Date.parse(e.in_at!), b = Date.parse(e.out_at!), dur = b - a, hours = Number(e.hours) || 0;
      const overlapMs = Math.max(0, Math.min(b, coveredEnd) - a);
      const overlapHours = dur > 0 ? Math.round(hours * (overlapMs / dur) * 100) / 100 : 0;
      if (overlapHours > 0) overlapPeople.add(pid);
      out.push({ ...e, effHours: Math.max(0, hours - overlapHours), overlapHours });
      coveredEnd = Math.max(coveredEnd, b);
    }
  }
  const overlapHours = Math.round(out.reduce((s, e) => s + e.overlapHours, 0) * 100) / 100;
  return { rows: out, shortExcluded, overlapHours, overlapPeople: [...overlapPeople] };
}

export function weekKpis(rows: DedupedEntry[]) {
  const pd = new Set<string>(); let hours = 0;
  for (const e of rows) { if (e.effHours > 0) pd.add(`${e.personnel_id}|${e.entry_date}`); hours += e.effHours; }
  return { personDays: pd.size, hours: Math.round(hours * 100) / 100 };
}

/** Billable estimate: rate per row from rateFor; non-billable rows/people excluded; rate-less billable hours reported, never silently $0. */
export function billableEstimate(rows: DedupedEntry[], rateFor: (e: DedupedEntry) => number | null | undefined, nonBillable: (pid: string) => boolean | undefined) {
  let total = 0, missingHours = 0, missingRows = 0;
  for (const e of rows) {
    if (e.effHours <= 0 || e.billable === false || !e.personnel_id || nonBillable(e.personnel_id) === true) continue;
    const r = rateFor(e);
    if (r != null && r > 0) total += e.effHours * r; else { missingHours += e.effHours; missingRows++; }
  }
  return { total: Math.round(total * 100) / 100, missingHours: Math.round(missingHours * 100) / 100, missingRows };
}

export const normName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
export type VendorRow = { id: string; name: string; vendor_type?: string | null; peopleTotal: number; onEventNow: number; hoursWeek: number; billWeek: number; w9?: boolean | null; insurance_expiry?: string | null };
export const isAgency = (v: { vendor_type?: string | null; peopleTotal: number }) => v.peopleTotal >= 2 || ['agency', 'company'].includes((v.vendor_type || '').toLowerCase());
const sortRows = (a: VendorRow, b: VendorRow) => (Number(b.onEventNow > 0) - Number(a.onEventNow > 0)) || (b.hoursWeek - a.hoursWeek) || a.name.localeCompare(b.name);
export function groupVendors(rows: VendorRow[]) {
  const counts = new Map<string, string[]>();
  for (const r of rows) { const k = normName(r.name); counts.set(k, [...(counts.get(k) || []), r.id]); }
  const duplicateOf = (r: VendorRow) => (counts.get(normName(r.name)) || []).filter(id => id !== r.id);
  return { agencies: rows.filter(isAgency).sort(sortRows), individuals: rows.filter(r => !isAgency(r)).sort(sortRows), duplicateOf };
}
export function insuranceWarning(expiry: string | null | undefined, today: string): 'expired' | 'soon' | null {
  if (!expiry) return null; if (expiry < today) return 'expired';
  const days = (Date.parse(expiry + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000;
  return days <= 30 ? 'soon' : null;
}
