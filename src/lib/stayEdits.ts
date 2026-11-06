import { locationTimeIso } from './manualTime';
import { localDay, localTime } from './signinSheets';
import { weekStart } from './shifts';
import { locationDays } from './sheetApprovalRules';

export type StayDraft = { id: string; inDate: string; inTime: string; outDate: string; outTime: string; removed: boolean };
export function draftStay(id: string, inAt: string, outAt: string | null, zone: string, day?: string): StayDraft {
  return { id, inDate: localDay(inAt, zone), inTime: localTime(inAt, zone), outDate: outAt ? localDay(outAt, zone) : day || localDay(inAt, zone), outTime: localTime(outAt, zone), removed: false };
}
export function stayRange(draft: StayDraft, zone: string) {
  const inAt = locationTimeIso(draft.inDate, draft.inTime, zone);
  const outAt = draft.outTime ? locationTimeIso(draft.outDate, draft.outTime, zone) : null;
  if (!inAt || (draft.outTime && (!outAt || outAt <= inAt))) return null;
  return { inAt, outAt };
}
export function affectedStayDates(oldIn: string, oldOut: string | null, newIn: string, newOut: string | null, zone: string) {
  return [...new Set([...locationDays(oldIn, oldOut, zone), ...locationDays(newIn, newOut, zone)])].sort();
}
export function affectedStayWeeks(oldIn: string, oldOut: string | null, newIn: string, newOut: string | null, zone: string) {
  // Operational days and Chicago payroll days both remain protected.
  return [...new Set([...affectedStayDates(oldIn, oldOut, newIn, newOut, zone), ...affectedStayDates(oldIn, oldOut, newIn, newOut, 'America/Chicago')].map(weekStart))];
}
export function staysForCell<T extends { id: string; personnel_id: string; date: string; location_id: string }>(entries: T[], pid: string, date: string, locationId?: string) {
  const matches = entries.filter(e => e.personnel_id === pid && e.date === date && (!locationId || e.location_id === locationId));
  return [...new Map(matches.map(e => [e.id.split(':')[0], e])).values()];
}