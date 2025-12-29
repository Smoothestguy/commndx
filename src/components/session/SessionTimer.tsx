import { useSessionAccess } from "@/hooks/useSessionAccess";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { useTodaySessions } from "@/hooks/useTodaySessions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock, Play, Square, Pause, DollarSign } from "lucide-react";
import { formatTimeHMS, formatSessionCurrency } from "@/utils/sessionTime";

export function SessionTimer() {
  // Check access once at the top level
  const { hasAccess, isChecking } = useSessionAccess();

  // Pass the access state to child hooks to avoid duplicate checks
  const {
    isLoading,
    isClockedIn,
    isIdle,
    hourlyRate,
    clockIn,
    clockOut,
  } = useSessionTracking(hasAccess, !isChecking);

  const {
    todayActiveSeconds,
    todayIdleSeconds,
    todayEarnings,
    sessionCount,
  } = useTodaySessions(hasAccess, !isChecking);

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
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-sidebar-accent/50">
            {isIdle ? (
              <Pause className="h-4 w-4 text-amber-500" />
            ) : (
              <Clock className="h-4 w-4 text-green-500 animate-pulse" />
            )}
            <span className="font-mono text-sm text-header-foreground">
              {formattedTodayTime}
            </span>
            {isIdle && (
              <Badge
                variant="outline"
                className="text-[10px] px-1 py-0 h-4 text-amber-500 border-amber-500/50"
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
          </div>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20">
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

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={clockOut}
            className="h-8 w-8 p-0 text-header-foreground hover:bg-sidebar-accent hover:text-destructive"
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
