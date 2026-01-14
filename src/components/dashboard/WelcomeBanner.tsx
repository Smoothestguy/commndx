import { useProfile } from "@/integrations/supabase/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { useDailyQuote } from "@/hooks/useDailyQuote";
import { DashboardTheme } from "./widgets/types";

const getGreeting = (): string => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

interface WelcomeBannerProps {
  theme?: DashboardTheme;
}

export const WelcomeBanner = ({ theme }: WelcomeBannerProps) => {
  const { data: profile, isLoading } = useProfile();
  const quote = useDailyQuote(profile?.id);

  const greeting = getGreeting();
  
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

  // Generate gradient style from theme accent color
  const getGradientStyle = () => {
    if (theme?.accentColor) {
      return {
        background: `linear-gradient(to right, ${theme.accentColor}e6, ${theme.accentColor}, ${theme.accentColor}cc)`,
      };
    }
    return undefined;
  };

  const gradientStyle = getGradientStyle();
  const baseClasses = "relative overflow-hidden rounded-xl p-4 sm:p-6 mb-4 sm:mb-6";
  const defaultGradient = "bg-gradient-to-r from-primary/90 via-primary to-primary/80";

  if (isLoading) {
    return (
      <div 
        className={`${baseClasses} ${!gradientStyle ? defaultGradient : ''}`}
        style={gradientStyle}
      >
        <div className="relative z-10">
          <Skeleton className="h-6 sm:h-8 w-48 sm:w-64 bg-white/20 mb-2" />
          <Skeleton className="h-4 w-32 sm:w-48 bg-white/20" />
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`${baseClasses} ${!gradientStyle ? defaultGradient : ''}`}
      style={gradientStyle}
    >
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-white/5 blur-xl" />
        <div className="absolute right-1/4 top-1/2 h-16 w-16 rounded-full bg-white/5 blur-lg" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground/80" />
            <span className="text-xs sm:text-sm font-medium text-primary-foreground/80 uppercase tracking-wide">
              {greeting}
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-heading font-bold text-primary-foreground mb-0.5 sm:mb-1">
            {getDisplayName()}
          </h2>
          <p className="text-xs sm:text-sm text-primary-foreground/70 italic leading-relaxed">
            "{quote.text}"
            {quote.author && <span className="not-italic text-primary-foreground/50"> — {quote.author}</span>}
          </p>
        </div>
        
        {/* Optional: Time display */}
        <div className="hidden sm:flex flex-col items-end text-primary-foreground/60">
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
