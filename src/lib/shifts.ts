/** Shift classification + Monday-start week helpers, all in America/Chicago local time. */
export const SHIFT_TZ = "America/Chicago";
export type Shift = "day" | "night";
export type ShiftStarts = { day_shift_start?: string | null; night_shift_start?: string | null; day_shift_end?: string | null; night_shift_end?: string | null };
export type LocationShiftMap = Record<string, ShiftStarts>;

export function resolveShiftStarts(location?: ShiftStarts, project?: ShiftStarts) {
  return {
    day: location?.day_shift_start ?? project?.day_shift_start ?? "06:00",
    night: location?.night_shift_start ?? project?.night_shift_start ?? "18:00",
  };
}

export function resolveShifts(location?: ShiftStarts, project?: ShiftStarts) {
  const starts = resolveShiftStarts(location, project);
  return { day: starts.day.slice(0,5), night: starts.night.slice(0,5), dayEnd: (location?.day_shift_end || project?.day_shift_end || starts.night).slice(0,5), nightEnd: (location?.night_shift_end || project?.night_shift_end || starts.day).slice(0,5) };
}

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

/** UTC instant of a Chicago calendar midnight, including DST transitions. */
export function chicagoMidnight(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const local = chicagoParts(new Date(instant));
    const [ly, lm, ld] = local.date.split("-").map(Number);
    const represented = Date.UTC(ly, lm - 1, ld) + local.minutes * 60_000;
    instant += target - represented;
  }
  return new Date(instant).toISOString();
}

/** Exact elapsed hours credited to each Chicago calendar date; no zero-length final segment. */
export function splitAtMidnight(inAt: string, outAt: string): { date: string; inAt: string; outAt: string; hours: number }[] {
  let start = new Date(inAt).getTime();
  const end = new Date(outAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const segments = [];
  while (start < end) {
    const date = chicagoParts(new Date(start)).date;
    const stop = Math.min(end, new Date(chicagoMidnight(addDays(date, 1))).getTime());
    segments.push({ date, inAt: new Date(start).toISOString(), outAt: new Date(stop).toISOString(), hours: (stop - start) / 3_600_000 });
    start = stop;
  }
  return segments;
}

/** Keep original punch times for detail displays and one original shift for every dated segment. */
export function timesheetSegments(inAt: string, outAt: string | null, location?: ShiftStarts, project?: ShiftStarts) {
  const starts = resolveShiftStarts(location, project);
  const shift = classifyShift(inAt, starts.day, starts.night);
  const dated = outAt ? splitAtMidnight(inAt, outAt) : [{ date: chicagoParts(inAt).date, hours: 0 }];
  return dated.map((s) => ({ date: s.date, hours: s.hours, shift, in_at: inAt, out_at: outAt, open: !outAt }));
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
