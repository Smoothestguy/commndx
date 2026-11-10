import type { WorksFor } from './personnelEmployer';

export const SEGMENT_ORDER: WorksFor[] = ['frg', 'agency', 'customer'];
export const SEGMENT_LABEL: Record<WorksFor, string> = { frg: 'FRG Workforce', agency: 'Agency', customer: 'Customer personnel' };

/** Customer employer wins over agency; nothing set = FRG workforce. */
export function personnelSegment(p: { vendor_id?: string | null; employer_customer_id?: string | null }): WorksFor {
  if (p.employer_customer_id) return 'customer';
  if (p.vendor_id) return 'agency';
  return 'frg';
}

export const normTag = (t: string) => t.trim().replace(/\s+/g, ' ');

/** Person must carry every required tag (case-insensitive). */
export function matchesAllTags(personTags: string[] | undefined, required: string[]) {
  if (!required.length) return true;
  const have = new Set((personTags ?? []).map(t => normTag(t).toLowerCase()));
  return required.every(r => have.has(normTag(r).toLowerCase()));
}

/** Picker order: FRG, then agency, then customer; bench first within a group; then name. */
export function pickerCompare<T extends { vendor_id?: string | null; employer_customer_id?: string | null; on_bench?: boolean | null; bench_rank?: number | null; first_name?: string | null; last_name?: string | null }>(a: T, b: T) {
  const s = SEGMENT_ORDER.indexOf(personnelSegment(a)) - SEGMENT_ORDER.indexOf(personnelSegment(b));
  if (s) return s;
  const bench = Number(!!b.on_bench) - Number(!!a.on_bench);
  if (bench) return bench;
  if (a.on_bench && b.on_bench) {
    const r = (a.bench_rank ?? 1e9) - (b.bench_rank ?? 1e9);
    if (r) return r;
  }
  return `${a.first_name ?? ''} ${a.last_name ?? ''}`.localeCompare(`${b.first_name ?? ''} ${b.last_name ?? ''}`);
}

/** Bench list order: rank (unranked last), then name. */
export function benchCompare<T extends { bench_rank?: number | null; first_name?: string | null; last_name?: string | null }>(a: T, b: T) {
  return (a.bench_rank ?? 1e9) - (b.bench_rank ?? 1e9) || `${a.first_name ?? ''} ${a.last_name ?? ''}`.localeCompare(`${b.first_name ?? ''} ${b.last_name ?? ''}`);
}

export interface EngagementRow { project_id: string; location_id: string | null; role: string | null; start: string | null; end: string | null }
/** Merge assignment rows into one engagement per project/location spanning earliest start → latest end (null end = ongoing). */
export function mergeEngagements(rows: EngagementRow[]) {
  const m = new Map<string, EngagementRow & { roles: string[] }>();
  for (const r of rows) {
    const k = `${r.project_id}:${r.location_id ?? ''}`;
    const cur = m.get(k);
    if (!cur) { m.set(k, { ...r, roles: r.role ? [r.role] : [] }); continue; }
    if (r.start && (!cur.start || r.start < cur.start)) cur.start = r.start;
    if (cur.end !== null && (r.end === null || r.end > cur.end)) cur.end = r.end;
    if (r.role && !cur.roles.includes(r.role)) cur.roles.push(r.role);
  }
  // Project-only rows are redundant when a location row exists for the same project.
  const withLoc = new Set([...m.values()].filter(e => e.location_id).map(e => e.project_id));
  return [...m.values()].filter(e => e.location_id || !withLoc.has(e.project_id))
    .sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''));
}
