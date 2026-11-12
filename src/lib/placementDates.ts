import { localDay } from './signinSheets';
import { locationTimeIso } from './manualTime';

/** Keep exact stored timestamps when their displayed date is untouched. */
export function placementDateTimestamp(day: string, original: string | null | undefined, time: string, timezone: string): string | null {
  if (!day) return null;
  if (original && day === localDay(original, timezone)) return original;
  return locationTimeIso(day, time, timezone);
}

export function placementDatesValid(start: string, end: string, ended: boolean): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return false;
  if (!end) return !ended;
  return /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start;
}