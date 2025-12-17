import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, DollarSign } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface TimeEntry {
  id: string;
  entry_date: string;
  regular_hours: number | null;
  overtime_hours: number | null;
}

interface WeekData {
  weekStart: Date;
  weekEnd: Date;
  daysWorked: number;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
}

interface ProjectWeeklyPayHistoryProps {
  timeEntries: TimeEntry[];
  hourlyRate: number | null;
  overtimeMultiplier?: number;
}

export function ProjectWeeklyPayHistory({ 
  timeEntries, 
  hourlyRate, 
  overtimeMultiplier = 1.5 
}: ProjectWeeklyPayHistoryProps) {
  const weeklyData = useMemo(() => {
    if (!timeEntries || timeEntries.length === 0) return [];

    // Group entries by week
    const weekMap = new Map<string, { entries: TimeEntry[]; dates: Set<string> }>();

    timeEntries.forEach((entry) => {
      const entryDate = parseISO(entry.entry_date);
      const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 }); // Monday start
      const weekKey = format(weekStart, "yyyy-MM-dd");

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { entries: [], dates: new Set() });
      }

      const weekData = weekMap.get(weekKey)!;
      weekData.entries.push(entry);
      weekData.dates.add(entry.entry_date);
    });

    // Calculate weekly totals
    const weeks: WeekData[] = [];
    const rate = hourlyRate || 0;

    weekMap.forEach((data, weekKey) => {
      const weekStart = parseISO(weekKey);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      const regularHours = data.entries.reduce((sum, e) => sum + (e.regular_hours || 0), 0);
      const overtimeHours = data.entries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
      const totalHours = regularHours + overtimeHours;

      const regularPay = regularHours * rate;
      const overtimePay = overtimeHours * rate * overtimeMultiplier;
      const totalPay = regularPay + overtimePay;

      weeks.push({
        weekStart,
        weekEnd,
        daysWorked: data.dates.size,
        regularHours,
        overtimeHours,
        totalHours,
        regularPay,
        overtimePay,
        totalPay,
      });
    });

    // Sort by week start descending (most recent first)
    return weeks.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  }, [timeEntries, hourlyRate, overtimeMultiplier]);

  if (weeklyData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Weekly Pay Periods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No time entries logged for this project yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Weekly Pay Periods
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {weeklyData.map((week) => (
          <div 
            key={format(week.weekStart, "yyyy-MM-dd")} 
            className="p-4 rounded-lg border bg-card"
          >
            {/* Week Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">
                  {format(week.weekStart, "MMM d")} - {format(week.weekEnd, "MMM d, yyyy")}
                </span>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                {week.daysWorked} day{week.daysWorked !== 1 ? "s" : ""} worked
              </span>
            </div>

            {/* Hours Breakdown */}
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex items-center gap-1 text-sm flex-wrap">
                <span>{week.regularHours.toFixed(1)}h</span>
                <span className="text-muted-foreground">+</span>
                <span className="text-amber-600">{week.overtimeHours.toFixed(1)}h OT</span>
                <span className="text-muted-foreground">=</span>
                <span className="font-semibold">{week.totalHours.toFixed(1)}h</span>
              </div>
            </div>

            {/* Pay Breakdown */}
            {hourlyRate !== null && hourlyRate > 0 && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex items-center gap-1 text-sm flex-wrap">
                  <span>{formatCurrency(week.regularPay)}</span>
                  <span className="text-muted-foreground">+</span>
                  <span className="text-amber-600">{formatCurrency(week.overtimePay)}</span>
                  <span className="text-xs text-muted-foreground">(1.5x)</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="font-semibold text-primary">{formatCurrency(week.totalPay)}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
