import { useMemo } from "react";
import { dayQuotes, nightQuotes, Quote } from "@/data/quotes";

// Simple hash function to generate a deterministic number from a string
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function useDailyQuote(userId: string | undefined): Quote {
  const quote = useMemo(() => {
    const hour = new Date().getHours();
    const isNight = hour >= 21 || hour < 5;
    const today = new Date().toDateString();
    
    // Use a fallback for users without ID (not logged in yet)
    const userSeed = userId || "default-user";
    
    // Generate deterministic index from userId + date + time period
    const seed = hashString(`${userSeed}-${today}-${isNight ? "night" : "day"}`);
    const quotes = isNight ? nightQuotes : dayQuotes;
    const index = seed % quotes.length;
    
    return quotes[index];
  }, [userId]);

  return quote;
}
