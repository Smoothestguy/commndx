import { Card } from "@/components/ui/card";
import { Clock, DollarSign, FileText, AlertCircle, Gift } from "lucide-react";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { formatCurrency } from "@/lib/utils";
import { calculateWeeklyOvertimeByEmployee, calculateLaborCost } from "@/lib/overtimeUtils";
import { useMemo } from "react";

interface TimeTrackingStatsProps {
  entries: TimeEntryWithDetails[];
}

export function TimeTrackingStats({ entries }: TimeTrackingStatsProps) {
  const { data: companySettings } = useCompanySettings();
  
  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const holidayMultiplier = companySettings?.holiday_multiplier ?? 2.0;
  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;

  // Calculate overtime PER EMPLOYEE using 40-hour weekly threshold
  const { regularHours, overtimeHours, totalHours } = useMemo(() => {
    return calculateWeeklyOvertimeByEmployee(
      entries.map(e => ({
        hours: Number(e.hours),
        personnel_id: e.personnel_id,
        user_id: e.user_id,
      })),
      weeklyOvertimeThreshold
    );
  }, [entries, weeklyOvertimeThreshold]);

  const holidayHours = entries
    .filter((entry) => entry.is_holiday)
    .reduce((sum, entry) => sum + Number(entry.hours), 0);
  
  // Calculate total cost per employee and sum up
  const totalCost = useMemo(() => {
    // Group entries by employee to calculate cost correctly
    const employeeData = new Map<string, { hours: number; holidayHours: number; rate: number }>();
    
    entries.forEach((entry) => {
      const key = entry.personnel_id || entry.user_id || "unknown";
      // Use || to fall back when rate is 0 (not just null/undefined)
      const rate = entry.hourly_rate 
        || entry.personnel?.hourly_rate 
        || entry.profiles?.hourly_rate 
        || 0;
      const hours = Number(entry.hours);
      const isHoliday = entry.is_holiday === true;
      
      const existing = employeeData.get(key);
      if (existing) {
        employeeData.set(key, { 
          hours: existing.hours + hours,
          holidayHours: existing.holidayHours + (isHoliday ? hours : 0),
          rate: rate || existing.rate // Use first non-zero rate found
        });
      } else {
        employeeData.set(key, { hours, holidayHours: isHoliday ? hours : 0, rate });
      }
    });
    
    let cost = 0;
    employeeData.forEach(({ hours, holidayHours, rate }) => {
      // Holiday hours are paid at full holiday rate, separated from regular/OT calculation
      const nonHolidayHours = hours - holidayHours;
      const empRegular = Math.min(nonHolidayHours, weeklyOvertimeThreshold);
      const empOvertime = Math.max(0, nonHolidayHours - weeklyOvertimeThreshold);
      
      // Non-holiday cost
      cost += calculateLaborCost(empRegular, empOvertime, rate, overtimeMultiplier);
      // Holiday cost at full multiplier (not as bonus)
      cost += holidayHours * rate * holidayMultiplier;
    });
    
    return cost;
  }, [entries, weeklyOvertimeThreshold, overtimeMultiplier, holidayMultiplier]);
  
  const uninvoicedHours = entries
    .filter((entry) => entry.status !== "invoiced")
    .reduce((sum, entry) => sum + Number(entry.hours), 0);
  
  const entryCount = entries.length;

  const stats = [
    {
      label: "Total Hours",
      value: totalHours.toFixed(2),
      icon: Clock,
      color: "text-primary",
    },
    {
      label: "Regular Hours",
      value: regularHours.toFixed(2),
      icon: Clock,
      color: "text-blue-500",
    },
    {
      label: "Overtime Hours",
      value: overtimeHours.toFixed(2),
      icon: AlertCircle,
      color: "text-orange-500",
    },
    {
      label: "Holiday Hours",
      value: holidayHours.toFixed(2),
      icon: Gift,
      color: "text-purple-500",
    },
    {
      label: "Total Cost",
      value: formatCurrency(totalCost),
      icon: DollarSign,
      color: "text-success",
    },
    {
      label: "Uninvoiced",
      value: uninvoicedHours.toFixed(2),
      icon: FileText,
      color: "text-warning",
    },
  ];

  return (
    <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className={`p-2 rounded-lg bg-muted/50 ${stat.color} self-start`}>
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                <p className="text-lg sm:text-xl font-bold truncate">{stat.value}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}