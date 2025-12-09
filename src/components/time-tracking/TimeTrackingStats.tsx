import { Card } from "@/components/ui/card";
import { Clock, DollarSign, FileText, AlertCircle, Gift } from "lucide-react";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { formatCurrency } from "@/lib/utils";

interface TimeTrackingStatsProps {
  entries: TimeEntryWithDetails[];
}

export function TimeTrackingStats({ entries }: TimeTrackingStatsProps) {
  const { data: companySettings } = useCompanySettings();
  
  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const holidayMultiplier = companySettings?.holiday_multiplier ?? 1.5;
  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;

  const totalHours = entries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  
  // Calculate weekly overtime (hours over threshold)
  const regularHours = Math.min(totalHours, weeklyOvertimeThreshold);
  const overtimeHours = Math.max(0, totalHours - weeklyOvertimeThreshold);

  const holidayHours = entries
    .filter((entry) => entry.is_holiday)
    .reduce((sum, entry) => sum + Number(entry.hours), 0);
  
  // Calculate total cost with weekly overtime
  const avgHourlyRate = entries.length > 0
    ? entries.reduce((sum, entry) => {
        return sum + (entry.personnel?.hourly_rate || entry.profiles?.hourly_rate || 0);
      }, 0) / entries.length
    : 0;
  
  const regularCost = regularHours * avgHourlyRate;
  const overtimeCost = overtimeHours * avgHourlyRate * overtimeMultiplier;
  const holidayBonus = holidayHours * avgHourlyRate * (holidayMultiplier - 1);
  
  const totalCost = regularCost + overtimeCost + holidayBonus;
  
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted/50 ${stat.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
