import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History, Clock } from "lucide-react";
import { useClockHistory, formatTime24h, formatDuration, formatHoursDetailed } from "@/integrations/supabase/hooks/useTimeClock";
import { Skeleton } from "@/components/ui/skeleton";

interface ClockHistoryTableProps {
  personnelId: string;
}

export function ClockHistoryTable({ personnelId }: ClockHistoryTableProps) {
  const { data: history, isLoading } = useClockHistory(personnelId, 14);

  const formatDate = (dateString: string) => {
    // Handle date-only strings (YYYY-MM-DD) to avoid timezone shifts
    const date = dateString.includes('T') 
      ? new Date(dateString)
      : new Date(dateString + 'T12:00:00'); // Parse as noon local time
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatHours = (hours: number | null) => {
    if (hours === null || hours === undefined) return "-";
    return formatHoursDetailed(hours);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Recent Clock History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const completedEntries = history?.filter((entry) => entry.clock_out_at) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Recent Clock History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {completedEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No clock history yet</p>
            <p className="text-sm">Your completed shifts will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-center">Clock In</TableHead>
                  <TableHead className="text-center">Lunch</TableHead>
                  <TableHead className="text-center">Clock Out</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatDate(entry.entry_date)}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {entry.project?.name || "Unknown"}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {formatTime24h(entry.clock_in_at)}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {entry.lunch_duration_minutes && entry.lunch_duration_minutes > 0
                        ? formatDuration(entry.lunch_duration_minutes)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {entry.clock_out_at ? formatTime24h(entry.clock_out_at) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatHours(entry.hours)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
