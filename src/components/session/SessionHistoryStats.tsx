import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Activity, Pause, Calendar } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton";

interface SessionHistoryStatsProps {
  dateRange?: DateRange;
}

export function SessionHistoryStats({ dateRange }: SessionHistoryStatsProps) {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["session-stats", user?.id, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!user) return null;

      let query = supabase
        .from("user_work_sessions")
        .select("total_active_seconds, total_idle_seconds, session_start")
        .eq("user_id", user.id);

      if (dateRange?.from) {
        query = query.gte("session_start", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("session_start", dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const totalActiveSecs = data.reduce(
        (acc, s) => acc + (s.total_active_seconds || 0),
        0
      );
      const totalIdleSecs = data.reduce(
        (acc, s) => acc + (s.total_idle_seconds || 0),
        0
      );
      const sessionCount = data.length;

      // Calculate average per session
      const avgActivePerSession =
        sessionCount > 0 ? Math.round(totalActiveSecs / sessionCount) : 0;

      return {
        totalActiveSecs,
        totalIdleSecs,
        sessionCount,
        avgActivePerSession,
      };
    },
    enabled: !!user,
  });

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Active Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatDuration(stats?.totalActiveSecs || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Across all sessions
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Idle Time</CardTitle>
          <Pause className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatDuration(stats?.totalIdleSecs || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Time spent idle
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sessions</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.sessionCount || 0}</div>
          <p className="text-xs text-muted-foreground">
            Work sessions recorded
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg per Session</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatDuration(stats?.avgActivePerSession || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Average active time
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
