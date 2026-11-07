/** A ended assignment never erases that location's worked-day membership. */
export function attendanceEligible(assignedOnDay: boolean, hasStayOnDay: boolean, hasTimeEntryOnDay: boolean) {
  return assignedOnDay || hasStayOnDay || hasTimeEntryOnDay;
}