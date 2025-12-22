import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIdleDetection } from "./useIdleDetection";

const TARGET_USER_EMAIL = "chris.guevara97@gmail.com";
const STORAGE_KEY = "session_tracking_state";
const SYNC_INTERVAL_MS = 30000; // Sync to DB every 30 seconds
const HOURLY_RATE = 23; // $23/hour

interface SessionState {
  sessionId: string | null;
  activeSeconds: number;
  idleSeconds: number;
  lastTickTime: number;
  isClockedIn: boolean;
}

export function useSessionTracking() {
  const { user } = useAuth();
  const isTargetUser = user?.email === TARGET_USER_EMAIL;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(Date.now());

  // Idle detection
  const { isIdle } = useIdleDetection({
    idleTimeoutMs: 5 * 60 * 1000, // 5 minutes
    enabled: isTargetUser && isClockedIn,
    onIdleStart: () => {
      logActivity("idle_start", "/", "User became idle");
    },
    onIdleEnd: () => {
      logActivity("idle_end", "/", "User resumed activity");
    },
  });

  // Load state from localStorage on mount
  useEffect(() => {
    if (!isTargetUser) {
      setIsLoading(false);
      return;
    }

    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const state: SessionState = JSON.parse(savedState);
        // Only restore if session is recent (within 24 hours)
        const hoursSinceLastTick =
          (Date.now() - state.lastTickTime) / (1000 * 60 * 60);
        if (hoursSinceLastTick < 24 && state.isClockedIn) {
          setSessionId(state.sessionId);
          setActiveSeconds(state.activeSeconds);
          setIdleSeconds(state.idleSeconds);
          setIsClockedIn(true);
        }
      } catch (e) {
        console.error("Error loading session state:", e);
      }
    }
    setIsLoading(false);
  }, [isTargetUser]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (!isTargetUser || !isClockedIn) return;

    const state: SessionState = {
      sessionId,
      activeSeconds,
      idleSeconds,
      lastTickTime: Date.now(),
      isClockedIn,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [isTargetUser, sessionId, activeSeconds, idleSeconds, isClockedIn]);

  // Timer tick - runs every second when clocked in
  useEffect(() => {
    if (!isTargetUser || !isClockedIn) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (isIdle) {
        setIdleSeconds((prev) => prev + 1);
      } else {
        setActiveSeconds((prev) => prev + 1);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isTargetUser, isClockedIn, isIdle]);

  // Sync to database periodically
  useEffect(() => {
    if (!isTargetUser || !isClockedIn || !sessionId) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    const syncToDatabase = async () => {
      try {
        await supabase
          .from("user_work_sessions")
          .update({
            total_active_seconds: activeSeconds,
            total_idle_seconds: idleSeconds,
          })
          .eq("id", sessionId);
        lastSyncRef.current = Date.now();
      } catch (e) {
        console.error("Error syncing session:", e);
      }
    };

    syncIntervalRef.current = setInterval(syncToDatabase, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isTargetUser, isClockedIn, sessionId, activeSeconds, idleSeconds]);

  // Log activity helper
  const logActivity = useCallback(
    async (
      activityType: string,
      route: string,
      actionName?: string,
      metadata?: object
    ) => {
      if (!isTargetUser || !sessionId || !user) return;

      try {
        await supabase.from("session_activity_log").insert([{
          session_id: sessionId,
          user_id: user.id,
          activity_type: activityType,
          route,
          action_name: actionName,
          metadata: metadata as Record<string, never> || {},
        }]);
      } catch (e) {
        console.error("Error logging activity:", e);
      }
    },
    [isTargetUser, sessionId, user]
  );

  // Clock in
  const clockIn = useCallback(
    async (type: "auto" | "manual" = "manual") => {
      if (!isTargetUser || !user || isClockedIn) return;

      try {
        const { data, error } = await supabase
          .from("user_work_sessions")
          .insert({
            user_id: user.id,
            user_email: user.email!,
            clock_in_type: type,
            session_start: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        setSessionId(data.id);
        setActiveSeconds(0);
        setIdleSeconds(0);
        setIsClockedIn(true);

        // Log the clock in
        await supabase.from("session_activity_log").insert([{
          session_id: data.id,
          user_id: user.id,
          activity_type: "clock_in",
          route: window.location.pathname,
          action_name: `Clocked in (${type})`,
        }]);
      } catch (e) {
        console.error("Error clocking in:", e);
      }
    },
    [isTargetUser, user, isClockedIn]
  );

  // Clock out
  const clockOut = useCallback(async () => {
    if (!isTargetUser || !sessionId || !user) return;

    try {
      // Final sync
      await supabase
        .from("user_work_sessions")
        .update({
          session_end: new Date().toISOString(),
          total_active_seconds: activeSeconds,
          total_idle_seconds: idleSeconds,
          is_active: false,
        })
        .eq("id", sessionId);

      // Log the clock out
      await supabase.from("session_activity_log").insert([{
        session_id: sessionId,
        user_id: user.id,
        activity_type: "clock_out",
        route: window.location.pathname,
        action_name: "Clocked out",
      }]);

      // Clear state
      setSessionId(null);
      setActiveSeconds(0);
      setIdleSeconds(0);
      setIsClockedIn(false);
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Error clocking out:", e);
    }
  }, [isTargetUser, sessionId, user, activeSeconds, idleSeconds]);

  // Format time helper
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Calculate earnings from active seconds
  const calculateEarnings = useCallback((seconds: number): number => {
    return (seconds / 3600) * HOURLY_RATE;
  }, []);

  // Format currency
  const formatCurrency = useCallback((amount: number): string => {
    return `$${amount.toFixed(2)}`;
  }, []);

  const currentEarnings = calculateEarnings(activeSeconds);

  return {
    isTargetUser,
    isLoading,
    isClockedIn,
    isIdle,
    activeSeconds,
    idleSeconds,
    formattedTime: formatTime(activeSeconds),
    formattedIdleTime: formatTime(idleSeconds),
    sessionId,
    clockIn,
    clockOut,
    logActivity,
    // Earnings
    hourlyRate: HOURLY_RATE,
    currentEarnings,
    formattedEarnings: formatCurrency(currentEarnings),
    calculateEarnings,
    formatCurrency,
  };
}
