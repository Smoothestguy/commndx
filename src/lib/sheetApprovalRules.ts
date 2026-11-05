import { localDay, nextDay } from './signinSheets';
export type SheetStatus = 'locked' | 'activity' | 'missing' | 'idle';
export const KIOSK_REFRESH_MS = 60_000;
export const KIOSK_RETURN_MS = 3_000;
export function sheetStatus(input: { locked: boolean; activity: boolean; assigned: boolean; day: string; mobe?: string | null; demobe?: string | null }): SheetStatus {
  if (input.locked) return 'locked';
  if (input.activity) return 'activity';
  if ((input.mobe && input.day < input.mobe) || (input.demobe && input.day > input.demobe)) return 'idle';
  return input.assigned ? 'missing' : 'idle';
}
export function locationDays(inAt: string, outAt: string | null, zone: string) {
  const result: string[] = []; const end = localDay(outAt || new Date().toISOString(), zone);
  for (let day = localDay(inAt, zone); day <= end && result.length < 367; day = nextDay(day)) result.push(day);
  return result;
}
export const validReopenReason = (reason: string) => reason.trim().length > 0 && reason.trim().length <= 1000;
export async function sha256(bytes: Uint8Array) { const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)); return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join(''); }
export function getSheetGps(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise(resolve => { if (!navigator.geolocation) return resolve(null); const timer = setTimeout(() => resolve(null), 8000); navigator.geolocation.getCurrentPosition(p => { clearTimeout(timer); resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); }, () => { clearTimeout(timer); resolve(null); }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }); });
}
