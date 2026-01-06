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
} from "@/utils/sessionTime";

interface SessionHistoryStatsProps {
  dateRange?: DateRange;
  targetUserId?: string | null;
}

interface SessionData {
  session_start: string;
  session_end: string | null;
  is_active: boolean;
  total_idle_seconds: number | null;
}

export function SessionHistoryStats({ dateRange, targetUserId }: SessionHistoryStatsProps) {
  const { user } = useAuth();
  const userId = targetUserId || user?.id;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["session-stats", userId, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!userId) return null;

      // Fetch sessions
      let query = supabase
        .from("user_work_sessions")
        .select("session_start, session_end, is_active, total_idle_seconds")
        .eq("user_id", userId);

      if (dateRange?.from) {
        query = query.gte("session_start", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("session_start", dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch hourly rate from personnel table
      const { data: personnelData } = await supabase
        .from("personnel")
        .select("hourly_rate")
        .eq("user_id", userId)
        .maybeSingle();

      const hourlyRate = personnelData?.hourly_rate ? Number(personnelData.hourly_rate) : 0;

      const sessions: SessionData[] = data || [];
      const now = new Date();

      // Use shared utility functions
      const totalActiveSecs = sumActiveSeconds(sessions, now);
      const totalIdleSecs = sumIdleSeconds(sessions);
      const sessionCount = sessions.length;

      // Calculate average per session
      const avgActivePerSession =
        sessionCount > 0 ? Math.round(totalActiveSecs / sessionCount) : 0;

      // Calculate earnings using shared utility with actual rate
      const totalEarnings = calculateEarningsFromSeconds(totalActiveSecs, hourlyRate);
      const avgEarningsPerSession = sessionCount > 0 ? totalEarnings / sessionCount : 0;

      return {
        totalActiveSecs,
        totalIdleSecs,
        sessionCount,
        avgActivePerSession,
        totalEarnings,
        avgEarningsPerSession,
        hourlyRate,
      };
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
              <Skeleton className="h-3 sm:h-4 w-16 sm:w-20" />
              <Skeleton className="h-3 w-3 sm:h-4 sm:w-4" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <Skeleton className="h-5 sm:h-8 w-12 sm:w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      <Card className="p-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Total Active</CardTitle>
          <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="text-lg sm:text-2xl font-bold">
            {formatDuration(stats?.totalActiveSecs || 0)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
            Across all sessions
          </p>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Total Idle</CardTitle>
          <Pause className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="text-lg sm:text-2xl font-bold">
            {formatDuration(stats?.totalIdleSecs || 0)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
            Time spent idle
          </p>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Sessions</CardTitle>
          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="text-lg sm:text-2xl font-bold">{stats?.sessionCount || 0}</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
            Work sessions recorded
          </p>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Avg/Session</CardTitle>
          <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="text-lg sm:text-2xl font-bold">
            {formatDuration(stats?.avgActivePerSession || 0)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
            Average active time
          </p>
        </CardContent>
      </Card>

      <Card className="p-0 bg-green-500/5 border-green-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Earnings</CardTitle>
          <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
            {formatSessionCurrency(stats?.totalEarnings || 0)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
            {stats?.hourlyRate ? `at $${stats.hourlyRate}/hour` : "No rate set"}
          </p>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Avg Earn</CardTitle>
          <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="text-lg sm:text-2xl font-bold">
            {formatSessionCurrency(stats?.avgEarningsPerSession || 0)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
            Per session average
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
