export type PunchIntent = { token: string; lat: number | null; lng: number | null; accuracy?: number | null; overrideReason?: string; earlyReason?: string; lateReason?: string; lateMinutes?: number; effectiveAt?: string; earlyFlagged?: boolean; signatureBase64?: string; committed?: boolean; at: string; tries: number; action: "in" | "out" };
const key = (token: string) => `site-punch-pending:${token}`;

export function readPunch(token: string): PunchIntent | null {
  try {
    const v = JSON.parse(localStorage.getItem(key(token)) ?? "null");
    return v?.token === token && typeof v.at === "string" && Number.isFinite(Date.parse(v.at)) && (v.action === "in" || v.action === "out") ? v : null;
  } catch { return null; }
}
export function savePunch(intent: PunchIntent) { localStorage.setItem(key(intent.token), JSON.stringify(intent)); }
export function clearPunch(token: string) { localStorage.removeItem(key(token)); }
export function isNetworkError(error: unknown): boolean {
  const e = error as { message?: string; details?: string; code?: string } | null;
  return /failed to fetch|fetch failed|network|load failed|connection|offline|timeout|timed out/i.test(`${e?.message ?? ""} ${e?.details ?? ""}`) && !e?.code;
}

const running = new Set<string>();
/** Web Locks prevent parallel retries from multiple tabs; module guard covers older browsers. */
export async function withPunchLock(token: string, send: () => Promise<void>) {
  if (running.has(token)) return;
  running.add(token);
  try {
    if (navigator.locks) await navigator.locks.request(`site-punch:${token}`, { ifAvailable: true }, async (lock) => { if (lock) await send(); });
    else await send();
  } finally { running.delete(token); }
}