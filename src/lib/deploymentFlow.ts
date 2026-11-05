import { localDay, midnight, nextDay } from './signinSheets';
export function staleVisitEnd(checkIn: string, now: string, zone: string): string | null {
  const day = localDay(checkIn, zone);
  return day < localDay(now, zone) ? new Date(midnight(nextDay(day), zone) - 1).toISOString() : null;
}
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (n: number) => n * Math.PI / 180;
  const d = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(d), Math.sqrt(Math.max(0, 1 - d)));
}
export function routeMiles(points: { lat: number | null; lng: number | null; at: string }[]) {
  const valid = points.filter((p): p is { lat: number; lng: number; at: string } => p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)).sort((a,b) => a.at.localeCompare(b.at));
  return valid.slice(1).reduce((sum, point, i) => sum + distanceKm(valid[i], point), 0) * 1.2 / 1.609344;
}
export function compactHours(hours: number) { return hours >= 1000 ? `${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(hours).toLowerCase()} h` : `${Math.round(hours)}h`; }
export function needsCrew(ids: string[], crews: { status: string; members: { personnel_id: string }[] }[]) {
  const unique = [...new Set(ids)];
  return unique.length >= 2 && !crews.some(c => c.status === 'active' && unique.every(id => c.members.some(m => m.personnel_id === id)));
}