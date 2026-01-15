import { Sparkles } from "lucide-react";
import { useProfile } from "@/integrations/supabase/hooks/useProfile";
import { useDailyQuote } from "@/hooks/useDailyQuote";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export function WelcomeStrip() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const quote = useDailyQuote(profile?.id);

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

  if (profileLoading) {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border border-border/50 rounded-lg">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-muted/30 border border-border/50 rounded-lg">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm text-muted-foreground">
          {getGreeting()},{" "}
          <span className="font-semibold text-foreground">{getDisplayName()}</span>
        </span>
        <span className="hidden sm:inline text-xs text-muted-foreground/60 ml-2">
          {format(new Date(), "EEEE, MMMM d")}
        </span>
      </div>
      
      {quote && (
        <p className="text-xs text-muted-foreground italic line-clamp-1">
          "{quote.text}" — {quote.author}
        </p>
      )}
    </div>
  );
}
