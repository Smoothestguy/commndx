import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Activity, Pause, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton";

const HOURLY_RATE = 23; // $23/hour

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

      // Calculate earnings
      const totalEarnings = (totalActiveSecs / 3600) * HOURLY_RATE;
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

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

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
            {formatCurrency(stats?.totalEarnings || 0)}
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
            {formatCurrency(stats?.avgEarningsPerSession || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Per session average
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
