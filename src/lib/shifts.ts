/** Shift classification + Monday-start week helpers, all in America/Chicago local time. */
export const SHIFT_TZ = "America/Chicago";
export type Shift = "day" | "night";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHIFT_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Chicago local date (YYYY-MM-DD) and minutes-of-day for an ISO timestamp. */
export function chicagoParts(iso: string | Date): { date: string; minutes: number } {
  const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const h = Number(p.hour) % 24;
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: h * 60 + Number(p.minute) };
}

/** "HH:MM[:SS]" → minutes of day. */
export function timeToMinutes(t: string | null | undefined, fallback: string): number {
  const [h, m] = (t || fallback).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** in_at time-of-day >= dayStart AND < nightStart → 'day', else 'night'. */
export function classifyShift(inAt: string | Date, dayStart = "06:00", nightStart = "18:00"): Shift {
  const { minutes } = chicagoParts(inAt);
  const d = timeToMinutes(dayStart, "06:00");
  const n = timeToMinutes(nightStart, "18:00");
  return minutes >= d && minutes < n ? "day" : "night";
}

/** Pure calendar math on YYYY-MM-DD strings. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Monday of the week containing the given Chicago date (YYYY-MM-DD). */
export function weekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun
  return addDays(date, -((dow + 6) % 7));
}

export function currentWeekStart(): string {
  return weekStart(chicagoParts(new Date()).date);
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** 'Mon 11/3' */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${m}/${d}`;
}
export function monthDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const mon = new Date(Date.UTC(y, m - 1, d)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${mon} ${d}`;
}

/** Chicago local 24-hour "HH:mm" for display/exports. */
export function chicagoTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: SHIFT_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}
