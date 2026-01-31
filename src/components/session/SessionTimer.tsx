import { useSessionAccess } from "@/hooks/useSessionAccess";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { useTodaySessions } from "@/hooks/useTodaySessions";
import { useUserDisplayPreferences } from "@/hooks/useUserDisplayPreferences";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock, Play, Square, Pause, DollarSign, RefreshCw } from "lucide-react";
import { formatTimeHMS, formatSessionCurrency, getStartOfToday } from "@/utils/sessionTime";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function SessionTimer() {
  // Check access once at the top level
  const { hasAccess, isChecking } = useSessionAccess();
  const [isFixingIdle, setIsFixingIdle] = useState(false);
  const queryClient = useQueryClient();

  // Pass the access state to child hooks to avoid duplicate checks
  const {
    isLoading,
    isClockedIn,
    isIdle,
    hourlyRate,
    sessionId,
    clockIn,
    clockOut,
  } = useSessionTracking(hasAccess, !isChecking);

  const {
    todayActiveSeconds,
    todayIdleSeconds,
    todayEarnings,
    sessionCount,
  } = useTodaySessions(hasAccess, !isChecking);

  const { showSessionEarnings } = useUserDisplayPreferences();

  // Reset idle time to zero for ALL of today's sessions
  const handleFixIdleTime = async () => {
    setIsFixingIdle(true);
    try {
      // Calculate start of today using the same logic as useTodaySessions
      const startOfToday = getStartOfToday();
      
      // Reset idle for all sessions from today
      const { data, error } = await supabase.functions.invoke("fix-session-idle", {
        body: { mode: "fixAllToday", startOfToday },
      });
      
      if (error) throw error;
      
      if (data?.success) {
        const count = data.sessionsFixed || 0;
        toast.success(`Idle time reset to zero for ${count} session${count !== 1 ? 's' : ''}`);
        // Invalidate queries to refresh the display
        queryClient.invalidateQueries({ queryKey: ["today-sessions"] });
        queryClient.invalidateQueries({ queryKey: ["session-history"] });
        // Force page reload to reset tracking state with corrected values
        window.location.reload();
      } else {
        toast.error(data?.error || "Failed to reset idle time");
      }
    } catch (err) {
      console.error("Error resetting idle time:", err);
      toast.error("Failed to reset idle time");
    } finally {
      setIsFixingIdle(false);
    }
  };

  // Only render for users with access
  if (isChecking || !hasAccess || isLoading) {
    return null;
  }

  if (!isClockedIn) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clockIn("manual")}
            className="h-8 gap-1.5 text-header-foreground hover:bg-sidebar-accent"
          >
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Clock In</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Start tracking your work session</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Use today's totals for display
  const formattedTodayTime = formatTimeHMS(todayActiveSeconds);
  const formattedTodayEarnings = formatSessionCurrency(todayEarnings);
  const formattedTodayIdleTime = formatTimeHMS(todayIdleSeconds);

  return (
    <div className="flex items-center gap-0.5 sm:gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5 sm:gap-1.5 px-1 sm:px-2 py-0.5 sm:py-1 rounded-md bg-sidebar-accent/50">
            {isIdle ? (
              <Pause className="h-3 w-3 text-amber-500" />
            ) : (
              <Clock className="h-3 w-3 text-green-500 animate-pulse" />
            )}
            <span className="font-mono text-[10px] sm:text-sm text-header-foreground">
              {formattedTodayTime}
            </span>
            {isIdle && (
              <Badge
                variant="outline"
                className="text-[10px] px-1 py-0 h-4 text-amber-500 border-amber-500/50 hidden sm:inline-flex"
              >
                IDLE
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p className="font-medium">Today's Totals</p>
            <p>Active time: {formattedTodayTime}</p>
            <p>Idle time: {formattedTodayIdleTime}</p>
            <p className="text-muted-foreground">{sessionCount} session{sessionCount !== 1 ? 's' : ''} today</p>
            {isIdle && (
              <p className="text-amber-500">Timer paused - you're idle</p>
            )}
            {todayIdleSeconds > 60 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFixIdleTime();
                }}
                disabled={isFixingIdle}
                className="mt-2 flex items-center gap-1 text-blue-500 hover:text-blue-400 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isFixingIdle ? "animate-spin" : ""}`} />
                {isFixingIdle ? "Resetting..." : "Reset idle time to zero"}
              </button>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {showSessionEarnings && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="font-mono text-sm text-green-600 dark:text-green-400 font-medium">
                {formattedTodayEarnings}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <p>Today's earnings</p>
              <p className="text-muted-foreground">Rate: ${hourlyRate}/hour</p>
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={clockOut}
            className="flex h-8 w-8 p-0 text-header-foreground hover:bg-sidebar-accent hover:text-destructive"
          >
            <Square className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Clock out and end session</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
