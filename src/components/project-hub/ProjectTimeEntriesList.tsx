import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, User } from "lucide-react";
import { useAllTimeEntries, TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useMemo } from "react";

interface ProjectTimeEntriesListProps {
  projectId: string;
}

export function ProjectTimeEntriesList({ projectId }: ProjectTimeEntriesListProps) {
  const { data: allTimeEntries, isLoading } = useAllTimeEntries(projectId);

  const timeEntries = useMemo(() => {
    return (allTimeEntries || []);
  }, [allTimeEntries]);

  const totals = useMemo(() => {
    let regularHours = 0;
    let overtimeHours = 0;
    let laborCost = 0;

    timeEntries.forEach((entry) => {
      const rate = entry.personnel?.hourly_rate || 0;
      regularHours += entry.regular_hours || 0;
      overtimeHours += entry.overtime_hours || 0;
      laborCost += (entry.regular_hours || 0) * rate + (entry.overtime_hours || 0) * rate * 1.5;
    });

    return { regularHours, overtimeHours, totalHours: regularHours + overtimeHours, laborCost };
  }, [timeEntries]);

  const columns: EnhancedColumn<TimeEntryWithDetails>[] = [
    {
      key: "personnel",
      header: "Personnel",
      sortable: true,
      filterable: true,
      getValue: (item) => item.personnel ? `${item.personnel.first_name} ${item.personnel.last_name}` : "Unknown",
      render: (item) => (
        <Link
          to={`/personnel/${item.personnel_id}`}
          className="text-primary hover:underline flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <User className="h-4 w-4" />
          {item.personnel ? `${item.personnel.first_name} ${item.personnel.last_name}` : "Unknown"}
        </Link>
      ),
    },
    {
      key: "entry_date",
      header: "Date",
      sortable: true,
      getValue: (item) => item.entry_date,
      render: (item) => format(new Date(item.entry_date), "MMM dd, yyyy"),
    },
    {
      key: "regular_hours",
      header: "Regular Hours",
      sortable: true,
      getValue: (item) => item.regular_hours,
      render: (item) => <span>{item.regular_hours?.toFixed(1) || "0"}</span>,
    },
    {
      key: "overtime_hours",
      header: "OT Hours",
      sortable: true,
      getValue: (item) => item.overtime_hours,
      render: (item) => (
        <span className={item.overtime_hours > 0 ? "text-orange-500 font-medium" : ""}>
          {item.overtime_hours?.toFixed(1) || "0"}
        </span>
      ),
    },
    {
      key: "total_hours",
      header: "Total Hours",
      sortable: true,
      getValue: (item) => (item.regular_hours || 0) + (item.overtime_hours || 0),
      render: (item) => (
        <span className="font-medium">
          {((item.regular_hours || 0) + (item.overtime_hours || 0)).toFixed(1)}
        </span>
      ),
    },
    {
      key: "labor_cost",
      header: "Labor Cost",
      sortable: true,
      getValue: (item) => {
        const rate = item.personnel?.hourly_rate || 0;
        return (item.regular_hours || 0) * rate + (item.overtime_hours || 0) * rate * 1.5;
      },
      render: (item) => {
        const rate = item.personnel?.hourly_rate || 0;
        const cost = (item.regular_hours || 0) * rate + (item.overtime_hours || 0) * rate * 1.5;
        return <span className="font-medium">{formatCurrency(cost)}</span>;
      },
    },
  ];

  return (
    <Card className="glass border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Time Tracking ({timeEntries.length})
          </CardTitle>
          {timeEntries.length > 0 && (
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Hours: </span>
                <span className="font-bold">{totals.totalHours.toFixed(1)}</span>
                <span className="text-muted-foreground ml-1">
                  ({totals.regularHours.toFixed(1)} reg + {totals.overtimeHours.toFixed(1)} OT)
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Labor Cost: </span>
                <span className="font-bold text-primary">{formatCurrency(totals.laborCost)}</span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading time entries...</div>
        ) : timeEntries.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No time entries recorded for this project yet.
          </div>
        ) : (
          <EnhancedDataTable
            tableId="project-time-entries"
            data={timeEntries}
            columns={columns}
          />
        )}
      </CardContent>
    </Card>
  );
}