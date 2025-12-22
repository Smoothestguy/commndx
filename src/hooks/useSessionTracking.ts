import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const TARGET_USER_EMAIL = "chris.guevara97@gmail.com";
const STORAGE_KEY = "session_tracking_state";
const SYNC_INTERVAL_MS = 30000; // Sync to DB every 30 seconds
const HOURLY_RATE = 23; // $23/hour
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface SessionState {
  sessionId: string | null;
  activeSeconds: number;
  idleSeconds: number;
  lastTickTime: number;
  isClockedIn: boolean;
  lastActivityTime: number;
  isIdle: boolean;
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
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const lastActivityTimeRef = useRef<number>(Date.now());
  const isIdleRef = useRef(false);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate elapsed time and update counters based on timestamps
  const updateTimeCounters = useCallback(() => {
    if (!isClockedIn) return;

    const now = Date.now();
    const elapsedMs = now - lastUpdateTimeRef.current;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    if (elapsedSeconds > 0) {
      if (isIdleRef.current) {
        setIdleSeconds((prev) => prev + elapsedSeconds);
      } else {
        setActiveSeconds((prev) => prev + elapsedSeconds);
      }
      lastUpdateTimeRef.current = now;
    }
  }, [isClockedIn]);

  // Reset idle timer on activity
  const resetIdleTimer = useCallback(() => {
    if (!isClockedIn) return;

    lastActivityTimeRef.current = Date.now();

    // If was idle, mark as active
    if (isIdleRef.current) {
      // First update counters with idle time
      updateTimeCounters();
      
      isIdleRef.current = false;
      setIsIdle(false);
      
      // Log activity resume
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
      if (!isClockedIn) return;
      
      // Update counters before switching to idle
      updateTimeCounters();
      
      isIdleRef.current = true;
      setIsIdle(true);
      
      // Log idle start
      if (sessionId && user) {
        supabase.from("session_activity_log").insert([{
          session_id: sessionId,
          user_id: user.id,
          activity_type: "idle_start",
          route: window.location.pathname,
          action_name: "User became idle",
        }]).then(() => {});
      }
    }, IDLE_TIMEOUT_MS);
  }, [isClockedIn, sessionId, user, updateTimeCounters]);

  // Handle visibility change - crucial for background tab tracking
  useEffect(() => {
    if (!isTargetUser || !isClockedIn) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is now hidden - update counters and switch to idle mode
        updateTimeCounters();
        
        if (!isIdleRef.current) {
          isIdleRef.current = true;
          setIsIdle(true);
          
          if (sessionId && user) {
            supabase.from("session_activity_log").insert([{
              session_id: sessionId,
              user_id: user.id,
              activity_type: "tab_hidden",
              route: window.location.pathname,
              action_name: "Tab became hidden (tracking as idle)",
            }]).then(() => {});
          }
        }
        
        // Clear the idle timeout since we're already idle
        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current);
          idleTimeoutRef.current = null;
        }
      } else {
        // Tab is now visible - calculate time spent hidden and add to idle
        const now = Date.now();
        const elapsedMs = now - lastUpdateTimeRef.current;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        
        if (elapsedSeconds > 0) {
          // All time while hidden counts as idle
          setIdleSeconds((prev) => prev + elapsedSeconds);
          lastUpdateTimeRef.current = now;
        }
        
        // Resume as active
        isIdleRef.current = false;
        setIsIdle(false);
        lastActivityTimeRef.current = now;
        
        // Restart idle timer
        resetIdleTimer();
        
        if (sessionId && user) {
          supabase.from("session_activity_log").insert([{
            session_id: sessionId,
            user_id: user.id,
            activity_type: "tab_visible",
            route: window.location.pathname,
            action_name: "Tab became visible (resumed active)",
          }]).then(() => {});
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isTargetUser, isClockedIn, sessionId, user, updateTimeCounters, resetIdleTimer]);

  // Activity event listeners
  useEffect(() => {
    if (!isTargetUser || !isClockedIn) return;

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click", "wheel"];
    
    let lastReset = 0;
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastReset > 1000) { // Throttle to once per second
        lastReset = now;
        resetIdleTimer();
      }
    };

    events.forEach((event) => {
      document.addEventListener(event, throttledReset, { passive: true });
    });

    // Start the idle timer
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

    // Reset the update time when starting
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
        const state: SessionState = JSON.parse(savedState);
        // Only restore if session is recent (within 24 hours)
        const hoursSinceLastTick = (Date.now() - state.lastTickTime) / (1000 * 60 * 60);
        
        if (hoursSinceLastTick < 24 && state.isClockedIn) {
          // Calculate additional idle time while the app was closed
          const additionalIdleSeconds = Math.floor((Date.now() - state.lastTickTime) / 1000);
          
          setSessionId(state.sessionId);
          setActiveSeconds(state.activeSeconds);
          setIdleSeconds(state.idleSeconds + additionalIdleSeconds);
          setIsClockedIn(true);
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

    const state: SessionState = {
      sessionId,
      activeSeconds,
      idleSeconds,
      lastTickTime: Date.now(),
      isClockedIn,
      lastActivityTime: lastActivityTimeRef.current,
      isIdle: isIdleRef.current,
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

  // Handle page unload - sync before closing
  useEffect(() => {
    if (!isTargetUser || !isClockedIn || !sessionId) return;

    const handleBeforeUnload = () => {
      // Update counters one final time
      updateTimeCounters();
      
      // Sync to database using sendBeacon for reliability
      const payload = JSON.stringify({
        total_active_seconds: activeSeconds,
        total_idle_seconds: idleSeconds,
      });
      
      // Save to localStorage as backup
      const state: SessionState = {
        sessionId,
        activeSeconds,
        idleSeconds,
        lastTickTime: Date.now(),
        isClockedIn: true,
        lastActivityTime: lastActivityTimeRef.current,
        isIdle: isIdleRef.current,
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

        const now = Date.now();
        setSessionId(data.id);
        setActiveSeconds(0);
        setIdleSeconds(0);
        setIsClockedIn(true);
        setIsIdle(false);
        isIdleRef.current = false;
        lastUpdateTimeRef.current = now;
        lastActivityTimeRef.current = now;

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
      // Update counters one final time
      updateTimeCounters();

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
      setIsIdle(false);
      isIdleRef.current = false;
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
    // Earnings
    hourlyRate: HOURLY_RATE,
    currentEarnings,
    formattedEarnings: formatCurrency(currentEarnings),
    calculateEarnings,
    formatCurrency,
  };
}
