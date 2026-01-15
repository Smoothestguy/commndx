import { Sparkles, Clock, LogIn, LogOut } from "lucide-react";
import { useProfile } from "@/integrations/supabase/hooks/useProfile";
import { useDailyQuote } from "@/hooks/useDailyQuote";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionAccess } from "@/hooks/useSessionAccess";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { useTodaySessions } from "@/hooks/useTodaySessions";
import { Button } from "@/components/ui/button";
import { formatTimeHMS } from "@/utils/sessionTime";
import { useIsMobile } from "@/hooks/use-mobile";

export function WelcomeStrip() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const quote = useDailyQuote(profile?.id);
  const isMobile = useIsMobile();
  
  // Session tracking hooks
  const { hasAccess, isChecking } = useSessionAccess();
  const { isClockedIn, isIdle, clockIn, clockOut, isLoading: sessionLoading } = useSessionTracking();
  const { todayActiveSeconds } = useTodaySessions(hasAccess, !isChecking);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getDisplayName = () => {
    if (!profile) return "";
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (profile.first_name) return profile.first_name;
    return profile.email?.split("@")[0] || "";
  };

  const showSessionControls = hasAccess && !isChecking && !sessionLoading && isMobile;

  if (profileLoading) {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border border-border/50 rounded-lg">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 bg-muted/30 border border-border/50 rounded-lg">
      {/* Left side: Greeting */}
      <div className="flex items-center gap-2 min-w-0">
        {showSessionControls && isClockedIn ? (
          <Clock className={`h-4 w-4 flex-shrink-0 ${isIdle ? "text-amber-500" : "text-green-500 animate-pulse"}`} />
        ) : (
          <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
        )}
        
        {showSessionControls && isClockedIn ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-semibold text-foreground">
              {formatTimeHMS(todayActiveSeconds)}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${isIdle ? "bg-amber-500/20 text-amber-600" : "bg-green-500/20 text-green-600"}`}>
              {isIdle ? "IDLE" : "ACTIVE"}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground truncate">
            {getGreeting()},{" "}
            <span className="font-semibold text-foreground">{getDisplayName()}</span>
          </span>
        )}
        
        <span className="hidden sm:inline text-xs text-muted-foreground/60 ml-2 flex-shrink-0">
          {format(new Date(), "EEEE, MMMM d")}
        </span>
      </div>

      {/* Right side: Quote (desktop) or Clock button (mobile) */}
      {showSessionControls ? (
        isClockedIn ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => clockOut()}
            className="h-7 px-2 text-xs border-destructive/50 text-destructive hover:bg-destructive/10 flex-shrink-0"
          >
            <LogOut className="h-3 w-3 mr-1" />
            Out
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => clockIn()}
            className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 flex-shrink-0"
          >
            <LogIn className="h-3 w-3 mr-1" />
            Clock In
          </Button>
        )
      ) : quote ? (
        <p className="hidden sm:block text-xs text-muted-foreground italic line-clamp-1">
          "{quote.text}" — {quote.author}
        </p>
      ) : null}
    </div>
  );
}
