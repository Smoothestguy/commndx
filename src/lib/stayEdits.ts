import { isClockIn, locationTimeIso } from './manualTime';
import { localDay, localTime } from './signinSheets';
import { weekStart } from './shifts';
import { locationDays } from './sheetApprovalRules';

export type StayDraft = { id: string; inDate: string; inTime: string; outDate: string; outTime: string; removed: boolean };
export function draftStay(id: string, inAt: string, outAt: string | null, zone: string, day?: string): StayDraft {
  const inDate = localDay(inAt, zone);
  let outDate = outAt ? localDay(outAt, zone) : day || inDate, outTime = localTime(outAt, zone);
  // A stay ending at next-day local midnight reads as 2400 on its last day.
  if (outAt && outTime === '00:00' && outDate > inDate) { outDate = new Date(Date.parse(`${outDate}T12:00:00Z`) - 864e5).toISOString().slice(0, 10); outTime = '24:00'; }
  return { id, inDate, inTime: localTime(inAt, zone), outDate, outTime, removed: false };
}
export function stayRange(draft: StayDraft, zone: string) {
  const inAt = isClockIn(draft.inTime) ? locationTimeIso(draft.inDate, draft.inTime, zone) : null;
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