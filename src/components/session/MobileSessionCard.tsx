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

  // Not clocked in - show start card
  if (!isClockedIn) {
    return (
      <Card className="md:hidden overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Start Your Day</h3>
              <p className="text-xs text-muted-foreground">Tap to begin tracking</p>
            </div>
          </div>
          
          <Button
            onClick={() => clockIn("manual")}
            className="w-full h-12 text-base font-semibold gap-2 bg-primary hover:bg-primary/90"
          >
            <Play className="h-5 w-5" />
            Clock In
          </Button>
          
          {sessionCount > 0 && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              {sessionCount} session{sessionCount !== 1 ? 's' : ''} today
            </p>
          )}
        </div>
      </Card>
    );
  }

  // Clocked in - show active session card
  return (
    <Card 
      className={`md:hidden overflow-hidden border-0 ${
        isIdle 
          ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-orange-500/20' 
          : 'bg-gradient-to-br from-green-500/20 via-green-500/10 to-emerald-500/20'
      }`}
    >
      <div className="p-4">
        {/* Status Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div 
              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                isIdle 
                  ? 'bg-amber-500/20' 
                  : 'bg-green-500/20'
              }`}
            >
              {isIdle ? (
                <Pause className="h-5 w-5 text-amber-500" />
              ) : (
                <Clock className="h-5 w-5 text-green-500 animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">
                  {isIdle ? 'Paused' : 'Working'}
                </h3>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-1.5 py-0 ${
                    isIdle 
                      ? 'text-amber-500 border-amber-500/50 bg-amber-500/10' 
                      : 'text-green-500 border-green-500/50 bg-green-500/10'
                  }`}
                >
                  {isIdle ? 'IDLE' : 'ACTIVE'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {isIdle ? 'Move to resume timer' : 'Session in progress'}
              </p>
            </div>
          </div>
        </div>

        {/* Timer Display */}
        <div className="text-center mb-4">
          <div 
            className={`font-mono text-4xl font-bold tracking-wider ${
              isIdle ? 'text-amber-500' : 'text-green-500'
            }`}
          >
            {formattedTodayTime}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Today's Active Time
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {showSessionEarnings && (
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-green-500 mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="font-mono font-semibold">{formattedTodayEarnings}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Today's Earnings</p>
            </div>
          )}
          <div className={`bg-background/50 rounded-lg p-3 text-center ${!showSessionEarnings ? 'col-span-2' : ''}`}>
            <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
              <Pause className="h-4 w-4" />
              <span className="font-mono font-semibold">{formattedTodayIdleTime}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Idle Time</p>
          </div>
        </div>

        {/* Clock Out Button */}
        <Button
          onClick={clockOut}
          variant="destructive"
          className="w-full h-12 text-base font-semibold gap-2"
        >
          <Square className="h-5 w-5" />
          Clock Out
        </Button>

        {/* Session info */}
        <p className="text-xs text-muted-foreground text-center mt-2">
          {sessionCount} session{sessionCount !== 1 ? 's' : ''} today • ${hourlyRate}/hr
        </p>
      </div>
    </Card>
  );
}
