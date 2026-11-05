export type KioskMode = 'search' | 'roster' | 'badge';
export function kioskMode(value: string | null): KioskMode {
  return value === 'roster' || value === 'badge' ? value : 'search';
}
export function badgeId(payload: string): string | null {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const plain = payload.trim();
  if (uuid.test(plain)) return plain.toLowerCase();
  try {
    const url = new URL(plain);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const candidate = url.searchParams.get('badge') || url.pathname.split('/').filter(Boolean).pop() || '';
    return uuid.test(candidate) ? candidate.toLowerCase() : null;
  } catch { return null; }
}
export const canManageBadges = (roles: string[]) => roles.some(r => r === 'admin' || r === 'manager');
export const searchReady = (query: string) => query.trim().length >= 3;
