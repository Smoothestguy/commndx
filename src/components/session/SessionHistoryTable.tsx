import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const HOURLY_RATE = 23; // $23/hour

interface SessionHistoryTableProps {
  dateRange?: DateRange;
  onSelectSession: (sessionId: string | null) => void;
  selectedSessionId: string | null;
  targetUserId?: string | null;
}

interface Session {
  id: string;
  session_start: string;
  session_end: string | null;
  total_active_seconds: number;
  total_idle_seconds: number;
  is_active: boolean;
  clock_in_type: string;
}

export function SessionHistoryTable({
  dateRange,
  onSelectSession,
  selectedSessionId,
  targetUserId,
}: SessionHistoryTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = targetUserId || user?.id;

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["session-history", userId, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from("user_work_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("session_start", { ascending: false });

      if (dateRange?.from) {
        query = query.gte("session_start", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("session_start", dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Session[];
    },
    enabled: !!userId,
  });

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Calculate active time from timestamps (not stored value) for accuracy
  const getActiveSecondsFromTimestamps = (session: Session): number => {
    const start = new Date(session.session_start).getTime();
    const end = session.session_end 
      ? new Date(session.session_end).getTime() 
      : Date.now();
    const totalSeconds = Math.floor((end - start) / 1000);
    const idleSeconds = session.total_idle_seconds || 0;
    return Math.max(0, totalSeconds - idleSeconds);
  };

  const calculateEarnings = (seconds: number): number => {
    return (seconds / 3600) * HOURLY_RATE;
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  const exportToCSV = () => {
    if (!sessions || sessions.length === 0) {
      toast({
        title: "No data to export",
        variant: "destructive",
      });
      return;
    }

    const csvContent = [
      ["Date", "Start Time", "End Time", "Active Time", "Idle Time", "Earnings", "Type"].join(","),
      ...sessions.map((s) => {
        const activeSeconds = getActiveSecondsFromTimestamps(s);
        return [
          format(new Date(s.session_start), "yyyy-MM-dd"),
          format(new Date(s.session_start), "HH:mm:ss"),
          s.session_end ? format(new Date(s.session_end), "HH:mm:ss") : "Active",
          formatDuration(activeSeconds),
          formatDuration(s.total_idle_seconds || 0),
          formatCurrency(calculateEarnings(activeSeconds)),
          s.clock_in_type,
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: "Session history has been downloaded",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Session History</CardTitle>
        <Button variant="outline" size="sm" onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {sessions && sessions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Active Time</TableHead>
                <TableHead>Idle Time</TableHead>
                <TableHead>Earnings</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => {
                const activeSeconds = getActiveSecondsFromTimestamps(session);
                return (
                  <TableRow
                    key={session.id}
                    className={
                      selectedSessionId === session.id ? "bg-muted/50" : ""
                    }
                  >
                    <TableCell>
                      {format(new Date(session.session_start), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(new Date(session.session_start), "h:mm a")}
                    </TableCell>
                    <TableCell>
                      {session.session_end ? (
                        format(new Date(session.session_end), "h:mm a")
                      ) : (
                        <Badge variant="default" className="bg-green-500">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatDuration(activeSeconds)}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {formatDuration(session.total_idle_seconds || 0)}
                    </TableCell>
                    <TableCell className="font-mono text-green-600 dark:text-green-400 font-medium">
                      {formatCurrency(calculateEarnings(activeSeconds))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{session.clock_in_type}</Badge>
                    </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onSelectSession(
                          selectedSessionId === session.id ? null : session.id
                        )
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No sessions found for the selected date range
          </div>
        )}
      </CardContent>
    </Card>
  );
}
