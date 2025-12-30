/**
 * Shared utility functions for calculating session time and earnings.
 * Used across SessionHistoryTable, SessionHistoryStats, and useSessionTracking.
 */

export const DEFAULT_HOURLY_RATE = 0; // Default when no rate found

interface Session {
  session_start: string;
  session_end: string | null;
  is_active: boolean;
  total_idle_seconds: number | null;
}

/**
 * Calculate active seconds for a single session using timestamps.
 * Active = elapsed - idle
 */
export function getActiveSecondsFromSession(
  session: Session,
  now: Date = new Date()
): number {
  const start = new Date(session.session_start);
  const end = session.session_end
    ? new Date(session.session_end)
    : session.is_active
      ? now
      : start;
  
  const elapsedSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
  const idleSeconds = session.total_idle_seconds || 0;
  return Math.max(0, elapsedSeconds - idleSeconds);
}

/**
 * Sum active seconds across multiple sessions.
 */
export function sumActiveSeconds(
  sessions: Session[],
  now: Date = new Date()
): number {
  return sessions.reduce(
    (acc, session) => acc + getActiveSecondsFromSession(session, now),
    0
  );
}

/**
 * Sum idle seconds across multiple sessions.
 */
export function sumIdleSeconds(sessions: Session[]): number {
  return sessions.reduce(
    (acc, session) => acc + (session.total_idle_seconds || 0),
    0
  );
}

/**
 * Calculate earnings from seconds.
 */
export function calculateEarningsFromSeconds(
  seconds: number,
  hourlyRate: number = DEFAULT_HOURLY_RATE
): number {
  return (seconds / 3600) * hourlyRate;
}

/**
 * Format duration in seconds to human-readable string.
 * Returns "Xh Ym" or "Ym" format.
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format duration in HH:MM:SS format.
 */
export function formatTimeHMS(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format currency amount.
 */
export function formatSessionCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Get start of today in local timezone as ISO string.
 */
export function getStartOfToday(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}
