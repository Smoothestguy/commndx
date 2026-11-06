import { localDay, localTime } from './signinSheets';

/** Interpret the input as a location wall-clock time, never the browser's timezone. */
export function locationTimeIso(day: string, time: string, zone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const target = Date.parse(`${day}T${time}:00Z`);
  if (!Number.isFinite(target)) return null;
  let at = target;
  for (let i = 0; i < 4; i++) {
    const iso = new Date(at).toISOString();
    const seen = Date.parse(`${localDay(iso, zone)}T${localTime(iso, zone)}:00Z`);
    at += target - seen;
  }
  const iso = new Date(at).toISOString();
  // Reject nonexistent local times during a DST jump rather than moving them silently.
  return localDay(iso, zone) === day && localTime(iso, zone) === time ? iso : null;
}

export function manualTimeRange(day: string, timeIn: string, timeOut: string, zone: string) {
  const inAt = locationTimeIso(day, timeIn, zone);
  const outAt = locationTimeIso(day, timeOut, zone);
  if (!inAt || !outAt || outAt <= inAt) return null;
  return { inAt, outAt, hours: (Date.parse(outAt) - Date.parse(inAt)) / 3600000 };
}

export function attendanceSaveMode(canManage: boolean, timeIn: string, timeOut: string) {
  return canManage && (timeIn || timeOut) ? (timeIn && timeOut ? 'manual' : 'incomplete') : 'hours';
}

export function locationRosterPeople<T extends { personnel_id: string }>(people: T[], locationId?: string, roster: { personnel_id: string }[] = []) {
  if (!locationId) return people;
  const ids = new Set(roster.map(p => p.personnel_id));
  return people.filter(p => ids.has(p.personnel_id));
}