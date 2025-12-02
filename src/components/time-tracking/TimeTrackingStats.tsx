import { Card } from "@/components/ui/card";
import { Clock, DollarSign, FileText, AlertCircle } from "lucide-react";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";

interface TimeTrackingStatsProps {
  entries: TimeEntryWithDetails[];
}

export function TimeTrackingStats({ entries }: TimeTrackingStatsProps) {
  const totalHours = entries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  
  const regularHours = entries.reduce(
    (sum, entry) => sum + Number(entry.regular_hours || entry.hours),
    0
  );

  const overtimeHours = entries.reduce(
    (sum, entry) => sum + Number(entry.overtime_hours || 0),
    0
  );
  
  const totalCost = entries.reduce((sum, entry) => {
    const hourlyRate = entry.profiles?.hourly_rate || 0;
    return sum + (Number(entry.hours) * Number(hourlyRate));
  }, 0);
  
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
      label: "Total Cost",
      value: `$${totalCost.toFixed(2)}`,
      icon: DollarSign,
      color: "text-success",
    },
    {
      label: "Uninvoiced Hours",
      value: uninvoicedHours.toFixed(2),
      icon: AlertCircle,
      color: "text-warning",
    },
    {
      label: "Entries",
      value: entryCount.toString(),
      icon: FileText,
      color: "text-accent",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted/50 ${stat.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
