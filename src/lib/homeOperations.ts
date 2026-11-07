import { addDays, chicagoMidnight } from './shifts';
import { midnight, nextDay } from './signinSheets';
import { attention, roleGaps, worstRole } from './commandCenter';

export const homeView = (role: string | null) => role === 'admin' || role === 'manager' ? 'operations' : role === 'accounting' ? 'accounting' : 'my-day';
export function upcomingDemobe(date: string | null, today: string) {
  return !!date && date >= today && date <= addDays(today, 3);
}
export function homeLocationState(byRole: Record<string, { needed: number; assigned: number }>, levels: Parameters<typeof roleGaps>[0], ops: {
  late: number; joinPending: number; openPunches: number; pendingTOs: number; extPending: number;
}, assets: { assetUnder: number; assetOver: number }, requests: number, missing: number) {
  const gaps = roleGaps(levels, byRole), worst = worstRole(gaps);
  const severity = attention({ staffSeverity: worst.severity, ...assets, ...ops, openRequests: requests });
  return { gaps, worst, severity: severity === 'ok' && missing > 0 ? 'amber' as const : severity };
}
/** Missing ink is one person per local location-day, not one missing stay. */
export function signatureCounts(rows: { personnel_id: string; signature_url: string | null }[]) {
  const signed = new Map<string, boolean>();
  for (const row of rows) signed.set(row.personnel_id, !!row.signature_url || !!signed.get(row.personnel_id));
  return { total: signed.size, missing: [...signed.values()].filter(v => !v).length };
}

/** Intersect each canonical Chicago ledger segment with the operational local day. */
export function closedDayHours(entry: { entry_date: string; hours: number | null; clock_in_at: string | null; clock_out_at: string | null }, day: string, zone: string) {
  if (!entry.clock_in_at) return entry.entry_date === day ? Number(entry.hours || 0) : 0;
  if (!entry.clock_out_at) return 0;
  const from = Math.max(Date.parse(entry.clock_in_at), Date.parse(chicagoMidnight(entry.entry_date)));
  const to = Math.min(Date.parse(entry.clock_out_at), Date.parse(chicagoMidnight(addDays(entry.entry_date,1))));
  if (to <= from) return 0;
  const overlap = Math.max(0, Math.min(midnight(nextDay(day),zone),to)-Math.max(midnight(day,zone),from));
  return Number(entry.hours || 0)*overlap/(to-from);
}