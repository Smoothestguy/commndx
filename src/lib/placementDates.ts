export function placementDatesValid(start: string, end: string, ended: boolean): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return false;
  if (!end) return !ended;
  return /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start;
}