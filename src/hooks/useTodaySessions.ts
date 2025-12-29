import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  sumActiveSeconds,
  sumIdleSeconds,
  calculateEarningsFromSeconds,
  getStartOfToday,
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
export function useTodaySessions() {
  const { user } = useAuth();

  const [hasAccess, setHasAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setTick] = useState(0);

  // Check if user has access (admin, manager, or user_management permission)
  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      setAccessChecked(true);
      setIsLoading(false);
      return;
    }

    const checkAccess = async () => {
      try {
        // Check if user is admin or manager
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (roleData?.role === "admin" || roleData?.role === "manager") {
          setHasAccess(true);
          setAccessChecked(true);
          return;
        }

        // Check if user has user_management permission
        const { data: permData } = await supabase
          .from("user_permissions")
          .select("can_view")
          .eq("user_id", user.id)
          .eq("module", "user_management")
          .single();

        setHasAccess(permData?.can_view === true);
        setAccessChecked(true);
      } catch (e) {
        console.error("Error checking access:", e);
        setHasAccess(false);
        setAccessChecked(true);
      }
    };

    checkAccess();
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
  const todayEarnings = calculateEarningsFromSeconds(todayActiveSeconds);
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
  };
}
