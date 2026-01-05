import {
  startOfWeek,
  endOfWeek,
  addDays,
  subDays,
  nextFriday,
  isFriday,
  format,
  parseISO,
  isBefore,
  isAfter,
  eachDayOfInterval
} from "date-fns";

export interface PayPeriod {
  weekStart: Date;
  weekEnd: Date;
  paymentDate: Date;
  label: string;
}

export interface DailyBreakdown {
  date: Date;
  dayName: string;
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
  totalHours: number;
}

/**
 * Get the last completed pay period (Mon-Sun that has already ended)
 * Pay periods are Mon-Sun, paid on the following Friday
 */
export function getLastCompletedPayPeriod(referenceDate: Date = new Date()): PayPeriod {
  // Get start of the current week (Monday)
  const currentWeekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  
  // If we're past Sunday of current week, last completed is current week
  // Otherwise, it's the previous week
  const lastWeekStart = subDays(currentWeekStart, 7);
  const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
  
  // Payment date is the Friday after the pay period ends
  const paymentDate = getPaymentDateForWeek(lastWeekStart);
  
  return {
    weekStart: lastWeekStart,
    weekEnd: lastWeekEnd,
    paymentDate,
    label: `${format(lastWeekStart, "MMM d")} - ${format(lastWeekEnd, "MMM d, yyyy")}`
  };
}

/**
 * Get the upcoming Friday payment date
 */
export function getUpcomingPayDate(referenceDate: Date = new Date()): Date {
  if (isFriday(referenceDate)) {
    return referenceDate;
  }
  return nextFriday(referenceDate);
}

/**
 * Get the payment date (Friday) for a given week
 */
export function getPaymentDateForWeek(weekStart: Date): Date {
  // Payment is on Friday after the week ends (Sunday)
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  // Next Friday after the week ends
  return nextFriday(addDays(weekEnd, 1));
}

/**
 * Get the pay period for a specific date
 */
export function getPayPeriodForDate(date: Date): PayPeriod {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  const paymentDate = getPaymentDateForWeek(weekStart);
  
  return {
    weekStart,
    weekEnd,
    paymentDate,
    label: `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`
  };
}

/**
 * Get all unique pay periods from time entries, sorted by most recent first
 */
export function getAllPayPeriodsFromEntries(
  entries: { entry_date: string }[]
): PayPeriod[] {
  if (!entries || entries.length === 0) return [];
  
  const periodMap = new Map<string, PayPeriod>();
  
  entries.forEach((entry) => {
    const entryDate = parseISO(entry.entry_date);
    const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 });
    const weekKey = format(weekStart, "yyyy-MM-dd");
    
    if (!periodMap.has(weekKey)) {
      periodMap.set(weekKey, getPayPeriodForDate(entryDate));
    }
  });
  
  // Sort by week start descending (most recent first)
  return Array.from(periodMap.values()).sort(
    (a, b) => b.weekStart.getTime() - a.weekStart.getTime()
  );
}

/**
 * Get daily breakdown for a specific pay period from time entries
 */
export function getDailyBreakdownForPeriod(
  entries: { entry_date: string; regular_hours: number | null; overtime_hours: number | null; is_holiday?: boolean }[],
  payPeriod: PayPeriod
): DailyBreakdown[] {
  // Get all days in the pay period (Mon-Sun)
  const daysInPeriod = eachDayOfInterval({
    start: payPeriod.weekStart,
    end: payPeriod.weekEnd
  });
  
  // Create a map of entry dates to hours
  const entryMap = new Map<string, { regular: number; overtime: number; holiday: number }>();
  entries.forEach((entry) => {
    const entryDate = parseISO(entry.entry_date);
    const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 });
    
    // Only include entries from this pay period
    if (format(weekStart, "yyyy-MM-dd") === format(payPeriod.weekStart, "yyyy-MM-dd")) {
      const dateKey = entry.entry_date;
      const existing = entryMap.get(dateKey) || { regular: 0, overtime: 0, holiday: 0 };
      const entryHours = (entry.regular_hours || 0) + (entry.overtime_hours || 0);
      entryMap.set(dateKey, {
        regular: existing.regular + (entry.regular_hours || 0),
        overtime: existing.overtime + (entry.overtime_hours || 0),
        holiday: existing.holiday + (entry.is_holiday ? entryHours : 0)
      });
    }
  });
  
  // Build daily breakdown for each day of the week
  return daysInPeriod.map((date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const hours = entryMap.get(dateKey) || { regular: 0, overtime: 0, holiday: 0 };
    
    return {
      date,
      dayName: format(date, "EEE"),
      regularHours: hours.regular,
      overtimeHours: hours.overtime,
      holidayHours: hours.holiday,
      totalHours: hours.regular + hours.overtime
    };
  });
}

/**
 * Calculate totals for a pay period from time entries
 * Uses 40-hour weekly threshold: first 40 hours = regular, anything over = overtime
 * Uses each entry's snapshotted hourly_rate when available, falls back to provided rate
 */
export function calculatePayPeriodTotals(
  entries: { entry_date: string; regular_hours: number | null; overtime_hours: number | null; hourly_rate?: number | null; hours?: number | null; is_holiday?: boolean }[],
  payPeriod: PayPeriod,
  fallbackHourlyRate: number = 0,
  overtimeMultiplier: number = 1.5,
  weeklyOvertimeThreshold: number = 40,
  holidayMultiplier: number = 2.0
) {
  const dailyBreakdown = getDailyBreakdownForPeriod(entries, payPeriod);
  
  // Calculate total hours worked in the week (ignore stored regular/overtime split)
  const totalHours = dailyBreakdown.reduce((sum, d) => sum + d.totalHours, 0);
  const holidayHours = dailyBreakdown.reduce((sum, d) => sum + d.holidayHours, 0);
  const daysWorked = dailyBreakdown.filter(d => d.totalHours > 0).length;
  
  // Apply 40-hour weekly threshold for single employee
  const regularHours = Math.min(totalHours, weeklyOvertimeThreshold);
  const overtimeHours = Math.max(0, totalHours - weeklyOvertimeThreshold);
  
  // Get entries for this pay period
  const periodEntries = entries.filter((entry) => {
    const entryDate = parseISO(entry.entry_date);
    const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 });
    return format(weekStart, "yyyy-MM-dd") === format(payPeriod.weekStart, "yyyy-MM-dd");
  });
  
  // Calculate pay using each entry's snapshotted hourly_rate (fallback to provided rate if missing)
  // We need to distribute the weekly OT threshold across entries chronologically
  let hoursAccumulated = 0;
  let regularPay = 0;
  let overtimePay = 0;
  let holidayPay = 0;
  
  // Sort entries by date to apply OT threshold correctly
  const sortedEntries = [...periodEntries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  
  sortedEntries.forEach((entry) => {
    const entryRate = entry.hourly_rate ?? fallbackHourlyRate;
    const entryTotalHours = (entry.regular_hours || 0) + (entry.overtime_hours || 0);
    const isHoliday = entry.is_holiday === true;
    
    let entryRegular = 0;
    let entryOvertime = 0;
    
    if (hoursAccumulated >= weeklyOvertimeThreshold) {
      // Already past threshold, all hours are overtime
      entryOvertime = entryTotalHours;
    } else if (hoursAccumulated + entryTotalHours > weeklyOvertimeThreshold) {
      // This entry crosses the threshold
      entryRegular = weeklyOvertimeThreshold - hoursAccumulated;
      entryOvertime = entryTotalHours - entryRegular;
    } else {
      // Still under threshold
      entryRegular = entryTotalHours;
    }
    
    hoursAccumulated += entryTotalHours;
    
    if (isHoliday) {
      // Holiday pay: hours × rate × holidayMultiplier (OT still applies on top if applicable)
      holidayPay += entryRegular * entryRate * holidayMultiplier;
      holidayPay += entryOvertime * entryRate * Math.max(overtimeMultiplier, holidayMultiplier);
    } else {
      regularPay += entryRegular * entryRate;
      overtimePay += entryOvertime * entryRate * overtimeMultiplier;
    }
  });
  
  const totalPay = regularPay + overtimePay + holidayPay;
  
  // Update daily breakdown to reflect correct overtime distribution
  // Overtime only kicks in after 40 weekly hours, so we need to recalculate
  let dailyHoursAccumulated = 0;
  const updatedDailyBreakdown = dailyBreakdown.map((day) => {
    const dayTotalHours = day.totalHours;
    let dayRegular = 0;
    let dayOvertime = 0;
    
    if (dailyHoursAccumulated >= weeklyOvertimeThreshold) {
      // Already past threshold, all hours are overtime
      dayOvertime = dayTotalHours;
    } else if (dailyHoursAccumulated + dayTotalHours > weeklyOvertimeThreshold) {
      // This day crosses the threshold
      dayRegular = weeklyOvertimeThreshold - dailyHoursAccumulated;
      dayOvertime = dayTotalHours - dayRegular;
    } else {
      // Still under threshold
      dayRegular = dayTotalHours;
    }
    
    dailyHoursAccumulated += dayTotalHours;
    
    return {
      ...day,
      regularHours: dayRegular,
      overtimeHours: dayOvertime,
    };
  });
  
  return {
    regularHours,
    overtimeHours,
    holidayHours,
    totalHours,
    daysWorked,
    regularPay,
    overtimePay,
    holidayPay,
    totalPay,
    dailyBreakdown: updatedDailyBreakdown
  };
}
