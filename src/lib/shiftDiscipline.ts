export type EarlyRejection = { reason: string; shift_start?: string; early_minutes?: number };
export const EARLY_REASONS = ['Supervisor asked', 'Prep work', 'Ride arrived early', 'Other'];
export const EXTENSION_REASONS = ['Finishing task', 'Customer request', 'Waiting on relief', 'Other'];
export function extensionChoices(now = Date.now(), shiftEnd?: string | null) {
  const step = 15 * 60_000;
  const limit = Math.min(now + 6 * 3600_000, shiftEnd ? Date.parse(shiftEnd) + 6 * 3600_000 : Infinity);
  const choices: string[] = [];
  for (let t = Math.floor(now / step) * step + step; t <= limit; t += step) choices.push(new Date(t).toISOString());
  return choices;
}
export function earlyApproval(reason?: string | null, by?: string | null, at?: string | null) {
  return reason ? (by && at ? 'approved' : 'pending supervisor approval') : null;
}