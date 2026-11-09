// Pure rules for multi-day timesheet signature requests (shared by the edge function and tests).
export const RESEND_COOLDOWN_MS = 60_000;
export const LOOKBACK_DAYS = 30;

export const localDay = (iso: string, zone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

type Stay = { in_at: string | null; visit_personnel_id: string | null; signature_url: string | null };

/** Local dates with at least one stay where none of that date's stays is signed, ascending. */
export function unsignedDates(stays: Stay[], zone: string): string[] {
  const days = new Map<string, boolean>();
  for (const s of stays) {
    if (!s.in_at || !s.visit_personnel_id) continue;
    const d = localDay(s.in_at, zone);
    days.set(d, (days.get(d) ?? false) || !!s.signature_url);
  }
  return [...days].filter(([, signed]) => !signed).map(([d]) => d).sort();
}

/** One resend per person per minute, measured from the latest send. */
export function resendWaitMs(lastSentAt: string | null, now = Date.now()) {
  if (!lastSentAt) return 0;
  return Math.max(0, RESEND_COOLDOWN_MS - (now - Date.parse(lastSentAt)));
}

/** "11/04, 11/05, 11/07" */
export const shortDates = (dates: string[]) => dates.map(d => `${d.slice(5, 7)}/${d.slice(8, 10)}`).join(', ');

export function requestMessage(location: string, dates: string[], link: string) {
  return dates.length === 1
    ? `Please sign your timesheet for ${location} on ${shortDates(dates)}/${dates[0].slice(0, 4)}: ${link}`
    : `Please sign your timesheets for ${shortDates(dates)} at ${location} (${dates.length} days): ${link}`;
}
