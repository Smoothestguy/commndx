import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const TARGET_USER_EMAIL = "chris.guevara97@gmail.com";
const HOURLY_RATE = 35;
const STORAGE_KEY = "session_tracking_state";
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity = idle
const SYNC_INTERVAL_MS = 30 * 1000; // Sync to DB every 30 seconds

interface StoredState {
  sessionId: string | null;
  clockedInAt: number | null;
  activeSeconds: number;
  idleSeconds: number;
  lastSyncAt: number;
  wasIdleAtLastSync: boolean;
}

export function useSessionTracking() {
  const { user } = useAuth();
  const isTargetUser = user?.email === TARGET_USER_EMAIL;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isIdle, setIsIdle] = useState(false);

  // Refs for timestamp-based tracking
  const clockedInAtRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const lastActivityTimeRef = useRef<number>(Date.now());
  const isIdleRef = useRef(false);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate elapsed time and update counters based on timestamps
  // KEY CHANGE: Background time counts as ACTIVE, only in-tab inactivity counts as idle
  const updateTimeCounters = useCallback(() => {
    if (!isClockedIn) return;

    const now = Date.now();
    const elapsedMs = now - lastUpdateTimeRef.current;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    if (elapsedSeconds > 0) {
      // Only count as idle if user was idle IN THE TAB (not just tab hidden)
      if (isIdleRef.current) {
        setIdleSeconds((prev) => prev + elapsedSeconds);
      } else {
        setActiveSeconds((prev) => prev + elapsedSeconds);
      }
      lastUpdateTimeRef.current = now;
    }
  }, [isClockedIn]);

  // Reset idle timer on activity (only when tab is visible)
  const resetIdleTimer = useCallback(() => {
    if (!isClockedIn) return;

    lastActivityTimeRef.current = Date.now();

    // If was idle, mark as active
    if (isIdleRef.current) {
      updateTimeCounters();
      isIdleRef.current = false;
      setIsIdle(false);

      if (sessionId && user) {
        supabase.from("session_activity_log").insert([{
          session_id: sessionId,
          user_id: user.id,
          activity_type: "idle_end",
          route: window.location.pathname,
          action_name: "User resumed activity",
        }]).then(() => {});
      }
    }

    // Reset the idle timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    idleTimeoutRef.current = setTimeout(() => {
      if (!isClockedIn || document.hidden) return; // Don't mark idle if tab is hidden
      
      updateTimeCounters();
      isIdleRef.current = true;
      setIsIdle(true);
      
      if (sessionId && user) {
        supabase.from("session_activity_log").insert([{
          session_id: sessionId,
          user_id: user.id,
          activity_type: "idle_start",
          route: window.location.pathname,
          action_name: "User became idle (5 min no activity)",
        }]).then(() => {});
      }
    }, IDLE_TIMEOUT_MS);
  }, [isClockedIn, sessionId, user, updateTimeCounters]);

  // Handle visibility change - KEY CHANGE: Hidden tab still counts as ACTIVE
  useEffect(() => {
    if (!isTargetUser || !isClockedIn) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is now hidden - but DON'T switch to idle!
        // Just update counters and continue counting as active
        updateTimeCounters();
        
        // Clear the idle timeout since we're in background
        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current);
          idleTimeoutRef.current = null;
        }
        
        if (sessionId && user) {
          supabase.from("session_activity_log").insert([{
            session_id: sessionId,
            user_id: user.id,
            activity_type: "tab_hidden",
            route: window.location.pathname,
            action_name: "Tab hidden (still counting as active)",
          }]).then(() => {});
        }
      } else {
        // Tab is now visible - calculate time spent hidden as ACTIVE
        const now = Date.now();
        const elapsedMs = now - lastUpdateTimeRef.current;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        
        if (elapsedSeconds > 0) {
          // Time while hidden counts as ACTIVE (key change!)
          setActiveSeconds((prev) => prev + elapsedSeconds);
          lastUpdateTimeRef.current = now;
        }
        
        // Reset activity tracking
        lastActivityTimeRef.current = now;
        
        // If was idle before hiding, resume as active
        if (isIdleRef.current) {
          isIdleRef.current = false;
          setIsIdle(false);
        }
        
        // Restart idle timer
        resetIdleTimer();
        
        if (sessionId && user) {
          supabase.from("session_activity_log").insert([{
            session_id: sessionId,
            user_id: user.id,
            activity_type: "tab_visible",
            route: window.location.pathname,
            action_name: "Tab visible (added background time as active)",
          }]).then(() => {});
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isTargetUser, isClockedIn, sessionId, user, updateTimeCounters, resetIdleTimer]);

  // Activity event listeners (only matter when tab is visible)
  useEffect(() => {
    if (!isTargetUser || !isClockedIn) return;

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click", "wheel"];
    
    let lastReset = 0;
    const throttledReset = () => {
      if (document.hidden) return; // Ignore events if tab is hidden
      const now = Date.now();
      if (now - lastReset > 1000) {
        lastReset = now;
        resetIdleTimer();
      }
    };

    events.forEach((event) => {
      document.addEventListener(event, throttledReset, { passive: true });
    });

    resetIdleTimer();

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledReset);
      });
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [isTargetUser, isClockedIn, resetIdleTimer]);

  // Periodic update interval - updates counters every second for display
  useEffect(() => {
    if (!isTargetUser || !isClockedIn) {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      return;
    }

    lastUpdateTimeRef.current = Date.now();

    updateIntervalRef.current = setInterval(() => {
      updateTimeCounters();
    }, 1000);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [isTargetUser, isClockedIn, updateTimeCounters]);

  // Load state from localStorage on mount
  useEffect(() => {
    if (!isTargetUser) {
      setIsLoading(false);
      return;
    }

    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const state: StoredState = JSON.parse(savedState);
        const hoursSinceLastSync = (Date.now() - state.lastSyncAt) / (1000 * 60 * 60);
        
        if (hoursSinceLastSync < 24 && state.sessionId && state.clockedInAt) {
          // Calculate additional time while the app was closed
          const additionalSeconds = Math.floor((Date.now() - state.lastSyncAt) / 1000);
          
          // KEY: If user was NOT idle when app closed, add elapsed time as ACTIVE
          const newActiveSeconds = state.wasIdleAtLastSync 
            ? state.activeSeconds 
            : state.activeSeconds + additionalSeconds;
          const newIdleSeconds = state.wasIdleAtLastSync 
            ? state.idleSeconds + additionalSeconds 
            : state.idleSeconds;
          
          setSessionId(state.sessionId);
          setActiveSeconds(newActiveSeconds);
          setIdleSeconds(newIdleSeconds);
          setIsClockedIn(true);
          clockedInAtRef.current = state.clockedInAt;
          lastUpdateTimeRef.current = Date.now();
          lastActivityTimeRef.current = Date.now();
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

    const state: StoredState = {
      sessionId,
      clockedInAt: clockedInAtRef.current,
      activeSeconds,
      idleSeconds,
      lastSyncAt: Date.now(),
      wasIdleAtLastSync: isIdleRef.current,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [isTargetUser, sessionId, activeSeconds, idleSeconds, isClockedIn]);

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

  // Handle page unload
  useEffect(() => {
    if (!isTargetUser || !isClockedIn || !sessionId) return;

    const handleBeforeUnload = () => {
      updateTimeCounters();
      
      const state: StoredState = {
        sessionId,
        clockedInAt: clockedInAtRef.current,
        activeSeconds,
        idleSeconds,
        lastSyncAt: Date.now(),
        wasIdleAtLastSync: isIdleRef.current,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isTargetUser, isClockedIn, sessionId, activeSeconds, idleSeconds, updateTimeCounters]);

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
        const now = Date.now();
        const { data, error } = await supabase
          .from("user_work_sessions")
          .insert({
            user_id: user.id,
            user_email: user.email!,
            clock_in_type: type,
            session_start: new Date(now).toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        setSessionId(data.id);
        setActiveSeconds(0);
        setIdleSeconds(0);
        setIsClockedIn(true);
        setIsIdle(false);
        isIdleRef.current = false;
        clockedInAtRef.current = now;
        lastUpdateTimeRef.current = now;
        lastActivityTimeRef.current = now;

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
      updateTimeCounters();

      await supabase
        .from("user_work_sessions")
        .update({
          session_end: new Date().toISOString(),
          total_active_seconds: activeSeconds,
          total_idle_seconds: idleSeconds,
          is_active: false,
        })
        .eq("id", sessionId);

      await supabase.from("session_activity_log").insert([{
        session_id: sessionId,
        user_id: user.id,
        activity_type: "clock_out",
        route: window.location.pathname,
        action_name: "Clocked out",
      }]);

      setSessionId(null);
      setActiveSeconds(0);
      setIdleSeconds(0);
      setIsClockedIn(false);
      setIsIdle(false);
      isIdleRef.current = false;
      clockedInAtRef.current = null;
      localStorage.removeItem(STORAGE_KEY);
      
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
    } catch (e) {
      console.error("Error clocking out:", e);
    }
  }, [isTargetUser, sessionId, user, activeSeconds, idleSeconds, updateTimeCounters]);

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
    hourlyRate: HOURLY_RATE,
    currentEarnings,
    formattedEarnings: formatCurrency(currentEarnings),
    calculateEarnings,
    formatTime,
  };
}
