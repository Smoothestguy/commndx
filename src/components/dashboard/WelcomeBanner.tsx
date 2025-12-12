import { useProfile } from "@/integrations/supabase/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

const getGreeting = (): string => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

const getContextMessage = (): string => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) return "Ready to start a productive day?";
  if (hour >= 12 && hour < 17) return "Hope your day is going great!";
  if (hour >= 17 && hour < 21) return "Wrapping up for the day?";
  return "Working late? Here's your overview.";
};

export const WelcomeBanner = () => {
  const { data: profile, isLoading } = useProfile();

  const greeting = getGreeting();
  const contextMessage = getContextMessage();
  
  const getDisplayName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (profile?.first_name) {
      return profile.first_name;
    }
    if (profile?.email) {
      return profile.email.split('@')[0];
    }
    return "there";
  };

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/90 via-primary to-primary/80 p-4 sm:p-6 mb-4 sm:mb-6 backdrop-blur-xl border border-primary/20 shadow-glow-lg">
        <div className="relative z-10">
          <Skeleton className="h-6 sm:h-8 w-48 sm:w-64 bg-primary-foreground/20 mb-2" />
          <Skeleton className="h-4 w-32 sm:w-48 bg-primary-foreground/20" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/90 via-primary to-primary/80 p-4 sm:p-6 mb-4 sm:mb-6 backdrop-blur-xl border border-primary/20 shadow-glow-lg">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary-foreground/10 blur-3xl animate-float" />
        <div className="absolute -left-4 -bottom-4 h-32 w-32 rounded-full bg-primary-foreground/5 blur-2xl" />
        <div className="absolute right-1/4 top-1/2 h-20 w-20 rounded-full bg-primary-foreground/10 blur-xl" />
        {/* Gradient overlay for glass effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-foreground/5 to-transparent" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-primary-foreground/10 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-primary-foreground/90 uppercase tracking-wide">
              {greeting}
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-heading font-bold text-primary-foreground mb-0.5 sm:mb-1">
            {getDisplayName()}
          </h2>
          <p className="text-xs sm:text-sm text-primary-foreground/80">
            {contextMessage}
          </p>
        </div>
        
        {/* Optional: Time display */}
        <div className="hidden sm:flex flex-col items-end text-primary-foreground/70">
          <span className="text-xs uppercase tracking-wider">Today</span>
          <span className="text-sm font-medium">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </span>
        </div>
      </div>
    </div>
  );
};