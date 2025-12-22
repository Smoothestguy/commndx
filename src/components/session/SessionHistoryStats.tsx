import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Activity, Pause, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton";
import {
  sumActiveSeconds,
  sumIdleSeconds,
  calculateEarningsFromSeconds,
  formatDuration,
  formatSessionCurrency,
  HOURLY_RATE,
} from "@/utils/sessionTime";

interface SessionHistoryStatsProps {
  dateRange?: DateRange;
}

interface SessionData {
  session_start: string;
  session_end: string | null;
  is_active: boolean;
  total_idle_seconds: number | null;
}

export function SessionHistoryStats({ dateRange }: SessionHistoryStatsProps) {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["session-stats", user?.id, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!user) return null;

      let query = supabase
        .from("user_work_sessions")
        .select("session_start, session_end, is_active, total_idle_seconds")
        .eq("user_id", user.id);

      if (dateRange?.from) {
        query = query.gte("session_start", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("session_start", dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const sessions: SessionData[] = data || [];
      const now = new Date();

      // Use shared utility functions
      const totalActiveSecs = sumActiveSeconds(sessions, now);
      const totalIdleSecs = sumIdleSeconds(sessions);
      const sessionCount = sessions.length;

      // Calculate average per session
      const avgActivePerSession =
        sessionCount > 0 ? Math.round(totalActiveSecs / sessionCount) : 0;

      // Calculate earnings using shared utility
      const totalEarnings = calculateEarningsFromSeconds(totalActiveSecs);
      const avgEarningsPerSession = sessionCount > 0 ? totalEarnings / sessionCount : 0;

      return {
        totalActiveSecs,
        totalIdleSecs,
        sessionCount,
        avgActivePerSession,
        totalEarnings,
        avgEarningsPerSession,
      };
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
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
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
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

      <Card className="bg-green-500/5 border-green-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
          <DollarSign className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatSessionCurrency(stats?.totalEarnings || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            at ${HOURLY_RATE}/hour
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Earnings</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatSessionCurrency(stats?.avgEarningsPerSession || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Per session average
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
