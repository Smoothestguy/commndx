/**
 * Overtime Calculation Utilities
 * 
 * Weekly overtime threshold: 40 hours per employee per week
 * - First 40 hours = regular hours
 * - Hours over 40 = overtime hours
 * - Overtime multiplier: 1.5x
 */

interface TimeEntryForOvertime {
  hours?: number;
  regular_hours?: number | null;
  overtime_hours?: number | null;
  personnel_id?: string | null;
  user_id?: string | null;
  entry_date?: string;
}

/**
 * Calculate weekly overtime by grouping entries per employee
 * Each employee gets 40 regular hours, anything beyond is overtime
 */
export function calculateWeeklyOvertimeByEmployee(
  entries: TimeEntryForOvertime[],
  weeklyThreshold: number = 40
): { regularHours: number; overtimeHours: number; totalHours: number } {
  if (!entries || entries.length === 0) {
    return { regularHours: 0, overtimeHours: 0, totalHours: 0 };
  }

  // Group total hours by employee (personnel_id or user_id)
  const personnelHours = new Map<string, number>();

  entries.forEach((entry) => {
    const personnelKey = entry.personnel_id || entry.user_id || "unknown";
    const entryHours = entry.hours ?? 
      ((entry.regular_hours || 0) + (entry.overtime_hours || 0));
    
    const currentTotal = personnelHours.get(personnelKey) || 0;
    personnelHours.set(personnelKey, currentTotal + entryHours);
  });

  // Calculate regular/overtime for EACH employee based on 40-hour threshold
  let totalRegular = 0;
  let totalOvertime = 0;

  personnelHours.forEach((hours) => {
    totalRegular += Math.min(hours, weeklyThreshold);
    totalOvertime += Math.max(0, hours - weeklyThreshold);
  });

  return {
    regularHours: totalRegular,
    overtimeHours: totalOvertime,
    totalHours: totalRegular + totalOvertime,
  };
}

/**
 * Calculate overtime for a single employee's weekly hours
 * Used when we already know the total hours for one person
 */
export function calculateSingleEmployeeOvertime(
  totalHours: number,
  weeklyThreshold: number = 40
): { regularHours: number; overtimeHours: number } {
  return {
    regularHours: Math.min(totalHours, weeklyThreshold),
    overtimeHours: Math.max(0, totalHours - weeklyThreshold),
  };
}

/**
 * Calculate labor cost with overtime multiplier
 */
export function calculateLaborCost(
  regularHours: number,
  overtimeHours: number,
  hourlyRate: number,
  overtimeMultiplier: number = 1.5
): number {
  return regularHours * hourlyRate + overtimeHours * hourlyRate * overtimeMultiplier;
}

/**
 * Calculate weekly overtime with per-employee breakdown
 * Returns both totals and per-employee details
 */
export function calculateWeeklyOvertimeWithBreakdown(
  entries: TimeEntryForOvertime[],
  weeklyThreshold: number = 40
): {
  totals: { regularHours: number; overtimeHours: number; totalHours: number };
  byEmployee: Map<string, { totalHours: number; regularHours: number; overtimeHours: number }>;
} {
  if (!entries || entries.length === 0) {
    return {
      totals: { regularHours: 0, overtimeHours: 0, totalHours: 0 },
      byEmployee: new Map(),
    };
  }

  // Group total hours by employee
  const personnelHours = new Map<string, number>();

  entries.forEach((entry) => {
    const personnelKey = entry.personnel_id || entry.user_id || "unknown";
    const entryHours = entry.hours ?? 
      ((entry.regular_hours || 0) + (entry.overtime_hours || 0));
    
    const currentTotal = personnelHours.get(personnelKey) || 0;
    personnelHours.set(personnelKey, currentTotal + entryHours);
  });

  // Calculate per-employee breakdown
  const byEmployee = new Map<string, { totalHours: number; regularHours: number; overtimeHours: number }>();
  let totalRegular = 0;
  let totalOvertime = 0;

  personnelHours.forEach((hours, personnelKey) => {
    const regular = Math.min(hours, weeklyThreshold);
    const overtime = Math.max(0, hours - weeklyThreshold);
    
    byEmployee.set(personnelKey, {
      totalHours: hours,
      regularHours: regular,
      overtimeHours: overtime,
    });
    
    totalRegular += regular;
    totalOvertime += overtime;
  });

  return {
    totals: {
      regularHours: totalRegular,
      overtimeHours: totalOvertime,
      totalHours: totalRegular + totalOvertime,
    },
    byEmployee,
  };
}
