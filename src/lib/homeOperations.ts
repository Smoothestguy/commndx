import { addDays } from './shifts';
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