import { useProfile } from "@/integrations/supabase/hooks/useProfile";
import { useDailyQuote } from "@/hooks/useDailyQuote";
import { Skeleton } from "@/components/ui/skeleton";

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

export function WelcomeStrip() {
  const { data: profile, isLoading } = useProfile();
  const quote = useDailyQuote(profile?.id);
  const greeting = getGreeting();

  const getDisplayName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (profile?.first_name) return profile.first_name;
    if (profile?.email) return profile.email.split("@")[0];
    return "there";
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-sm">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-sm">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">
          {greeting}, <span className="font-semibold">{getDisplayName()}</span>
        </span>
        <span className="hidden sm:inline text-muted-foreground">•</span>
        <span className="hidden sm:inline text-sm text-muted-foreground">{today}</span>
      </div>
      <p className="hidden md:block text-sm text-muted-foreground italic truncate max-w-md">
        "{quote.text}"
        {quote.author && <span className="not-italic text-muted-foreground/70"> — {quote.author}</span>}
      </p>
    </div>
  );
}
