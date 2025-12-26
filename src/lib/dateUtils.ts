import { format } from "date-fns";

/**
 * Parses a date-only string (YYYY-MM-DD) as a local date without timezone shift.
 * JavaScript's new Date("YYYY-MM-DD") treats it as UTC midnight, which can show
 * as the previous day in timezones behind UTC (e.g., US timezones).
 * Adding T12:00:00 ensures it stays on the correct day in all timezones.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  // If it's already a full ISO string with time, parse normally
  if (dateStr.includes("T")) {
    return new Date(dateStr);
  }
  
  // For date-only strings, add midday time to avoid timezone issues
  return new Date(dateStr + "T12:00:00");
}

/**
 * Formats a date-only string (YYYY-MM-DD) for display without timezone shift.
 */
export function formatLocalDate(dateStr: string, formatStr: string = "MMM d, yyyy"): string {
  return format(parseLocalDate(dateStr), formatStr);
}
