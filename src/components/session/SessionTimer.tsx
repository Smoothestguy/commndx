import { useSessionTracking } from "@/hooks/useSessionTracking";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock, Play, Square, Pause } from "lucide-react";

export function SessionTimer() {
  const {
    isTargetUser,
    isLoading,
    isClockedIn,
    isIdle,
    formattedTime,
    formattedIdleTime,
    clockIn,
    clockOut,
  } = useSessionTracking();

  // Only render for the target user
  if (!isTargetUser || isLoading) {
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
              {formattedTime}
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
            <p>Active time: {formattedTime}</p>
            <p>Idle time: {formattedIdleTime}</p>
            {isIdle && (
              <p className="text-amber-500">Timer paused - you're idle</p>
            )}
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
