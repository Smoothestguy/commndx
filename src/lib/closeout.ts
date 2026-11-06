import type { AuthorizationLevel } from './locationAuthorization';

/** Final demobilization lines: zero every still-authorized position/asset. */
export function demobLines(levels: AuthorizationLevel[]) {
  return levels.filter(l => Number(l.authorized) > 0 && (l.line_kind === 'position' || l.line_kind === 'asset'))
    .map(l => ({ line_kind: l.line_kind as 'position' | 'asset', label: l.label, qty_delta: -Math.min(500, Math.round(Number(l.authorized))) }));
}

export type CloseoutBlockers = { openPunches: number; fieldRequests: number; joinRequests: number };
export function closeoutBlocked(b: CloseoutBlockers) { return b.openPunches > 0 || b.fieldRequests > 0 || b.joinRequests > 0; }

/** Locations that still prevent a project close-out (anything not 'closed', including inactive). */
export function openLocations<T extends { status: string | null }>(locations: T[]) { return locations.filter(l => l.status !== 'closed'); }

export function projectSummary(locations: { mobe_date: string | null; demobe_date: string | null; closeout_date?: string | null }[], entries: { entry_date: string; hours: number | string | null }[]) {
  const starts = [...locations.map(l => l.mobe_date), ...entries.map(e => e.entry_date)].filter(Boolean).sort() as string[];
  const ends = [...locations.map(l => l.closeout_date ?? l.demobe_date), ...entries.map(e => e.entry_date)].filter(Boolean).sort() as string[];
  const hours = Math.round(entries.reduce((s, e) => s + (Number(e.hours) || 0), 0) * 100) / 100;
  return { start: starts[0] ?? null, end: ends[ends.length - 1] ?? null, hours, locations: locations.length };
}
