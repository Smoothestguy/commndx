import { shiftAt } from '../../supabase/functions/_shared/rosterRules';

/** In-memory adapter: intentionally has no network, storage or GPS dependencies. */
export function createSitePunchDemo(now = new Date()) {
  const zone = 'America/Chicago';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  const day = `${part('year')}-${part('month')}-${part('day')}`;
  const shiftStart = new Date(shiftAt(day, '07:00', zone)).toISOString();
  const shiftEnd = new Date(shiftAt(day, '19:00', zone)).toISOString();
  return {
    info: { valid: true, first_name: 'Demo', location_name: 'Demo Site — Sample Location', address: '123 Main St, Houston, TX', timezone: zone, shift_start: shiftStart, shift_end: shiftEnd, on_site_since: null as string | null },
    intent(action: 'in' | 'out') { return { token: 'demo', action, at: new Date().toISOString(), lat: 29.76, lng: -95.37, accuracy: 5, tries: 0 }; },
    rejection(kind: 'late' | 'early') { return { reason: kind === 'late' ? 'late' : 'before_shift', timezone: zone, shift_start: shiftStart, minutes_late: 15, grace_minutes: 10, early_minutes: 15 }; },
  };
}
export type SitePunchDemo = ReturnType<typeof createSitePunchDemo>;