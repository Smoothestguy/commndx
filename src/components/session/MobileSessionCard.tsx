import { useSessionAccess } from "@/hooks/useSessionAccess";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { useTodaySessions } from "@/hooks/useTodaySessions";
import { useUserDisplayPreferences } from "@/hooks/useUserDisplayPreferences";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Square, Pause, DollarSign, Zap } from "lucide-react";
import { formatTimeHMS, formatSessionCurrency } from "@/utils/sessionTime";

export function MobileSessionCard() {
  const { hasAccess, isChecking } = useSessionAccess();

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

  const { showSessionEarnings } = useUserDisplayPreferences();

  // Only show on mobile and for users with access
  if (isChecking || !hasAccess || isLoading) {
    return null;
  }

  const formattedTodayTime = formatTimeHMS(todayActiveSeconds);
  const formattedTodayEarnings = formatSessionCurrency(todayEarnings);
  const formattedTodayIdleTime = formatTimeHMS(todayIdleSeconds);

  // Not clocked in - show compact start card
  if (!isClockedIn) {
    return (
      <Card className="md:hidden overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Ready to work?</p>
            {sessionCount > 0 && (
              <p className="text-[10px] text-muted-foreground">{sessionCount} session{sessionCount !== 1 ? 's' : ''} today</p>
            )}
          </div>
          <Button
            onClick={() => clockIn("manual")}
            size="sm"
            className="h-9 px-4 font-semibold gap-1.5 bg-primary hover:bg-primary/90"
          >
            <Play className="h-4 w-4" />
            Clock In
          </Button>
        </div>
      </Card>
    );
  }

  // Clocked in - show compact active session card
  return (
    <Card 
      className={`md:hidden overflow-hidden border-0 ${
        isIdle 
          ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/10' 
          : 'bg-gradient-to-r from-green-500/15 to-emerald-500/10'
      }`}
    >
      <div className="p-3">
        <div className="flex items-center gap-3">
          {/* Status Icon */}
          <div 
            className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
              isIdle ? 'bg-amber-500/20' : 'bg-green-500/20'
            }`}
          >
            {isIdle ? (
              <Pause className="h-4 w-4 text-amber-500" />
            ) : (
              <Clock className="h-4 w-4 text-green-500 animate-pulse" />
            )}
          </div>

          {/* Timer & Stats */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span 
                className={`font-mono text-xl font-bold ${
                  isIdle ? 'text-amber-500' : 'text-green-500'
                }`}
              >
                {formattedTodayTime}
              </span>
              <Badge 
                variant="outline" 
                className={`text-[9px] px-1 py-0 h-4 ${
                  isIdle 
                    ? 'text-amber-500 border-amber-500/50' 
                    : 'text-green-500 border-green-500/50'
                }`}
              >
                {isIdle ? 'IDLE' : 'ACTIVE'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {showSessionEarnings && (
                <span className="flex items-center gap-0.5 text-green-600">
                  <DollarSign className="h-3 w-3" />
                  {formattedTodayEarnings}
                </span>
              )}
              <span>•</span>
              <span>{sessionCount} session{sessionCount !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Clock Out Button */}
          <Button
            onClick={clockOut}
            variant="destructive"
            size="sm"
            className="h-9 px-3 font-semibold gap-1.5"
          >
            <Square className="h-4 w-4" />
            Out
          </Button>
        </div>
      </div>
    </Card>
  );
}
