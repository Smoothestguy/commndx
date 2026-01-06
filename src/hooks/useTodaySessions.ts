import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  sumActiveSeconds,
  sumIdleSeconds,
  calculateEarningsFromSeconds,
  getStartOfToday,
  DEFAULT_HOURLY_RATE,
} from "@/utils/sessionTime";

interface TodaySession {
  session_start: string;
  session_end: string | null;
  is_active: boolean;
  total_idle_seconds: number | null;
}

/**
 * Hook to fetch and compute today's total session time and earnings.
 * Updates every second to reflect current active session.
 * Access is granted to admins, managers, or users with user_management permission.
 */
export function useTodaySessions(externalHasAccess?: boolean, externalAccessChecked?: boolean) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  // Use external access state if provided, otherwise default to false
  const hasAccess = externalHasAccess ?? false;
  const accessChecked = externalAccessChecked ?? true;

  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setTick] = useState(0);
  const [hourlyRate, setHourlyRate] = useState<number>(DEFAULT_HOURLY_RATE);

  // Fetch hourly rate from personnel table
  useEffect(() => {
    if (!user) return;

    const fetchRate = async () => {
      const { data } = await supabase
        .from("personnel")
        .select("hourly_rate")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.hourly_rate) {
        setHourlyRate(Number(data.hourly_rate));
      }
    };

    fetchRate();
  }, [user]);

  // Fetch today's sessions
  useEffect(() => {
    if (!accessChecked || !hasAccess || !user) {
      if (accessChecked) setIsLoading(false);
      return;
    }

    const fetchTodaySessions = async () => {
      try {
        const startOfToday = getStartOfToday();

        const { data, error } = await supabase
          .from("user_work_sessions")
          .select("session_start, session_end, is_active, total_idle_seconds")
          .eq("user_id", user.id)
          .gte("session_start", startOfToday)
          .order("session_start", { ascending: true });

        if (error) throw error;
        setTodaySessions(data || []);
      } catch (e) {
        console.error("Error fetching today's sessions:", e);
      }
      setIsLoading(false);
    };

    fetchTodaySessions();

    // Refresh sessions every 30 seconds to catch any new data
    const interval = setInterval(fetchTodaySessions, 30000);
    return () => clearInterval(interval);
  }, [accessChecked, hasAccess, user]);

  // Tick every second to update computed values for active sessions
  useEffect(() => {
    if (!hasAccess) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [hasAccess]);

  const now = new Date();
  const todayActiveSeconds = sumActiveSeconds(todaySessions, now);
  const todayIdleSeconds = sumIdleSeconds(todaySessions);
  const todayEarnings = calculateEarningsFromSeconds(todayActiveSeconds, hourlyRate);
  const sessionCount = todaySessions.length;
  const hasActiveSession = todaySessions.some((s) => s.is_active);

  return {
    isTargetUser: hasAccess,
    isLoading,
    todayActiveSeconds,
    todayIdleSeconds,
    todayEarnings,
    sessionCount,
    hasActiveSession,
    todaySessions,
    hourlyRate,
    isAdmin, // Expose admin status for UI components
  };
}
