import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const HOURLY_RATE = 23; // $23/hour
const STORAGE_KEY = "session_tracking_state";
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity = idle
const SYNC_INTERVAL_MS = 30 * 1000; // Sync to DB every 30 seconds

interface StoredState {
  sessionId: string | null;
  clockedInAt: number | null;
  idleSeconds: number;
  lastSyncAt: number;
  wasIdleAtLastSync: boolean;
}

export function useSessionTracking(externalHasAccess?: boolean, externalAccessChecked?: boolean) {
  const { user } = useAuth();

  // Use external access state if provided, otherwise default to false
  const hasAccess = externalHasAccess ?? false;
  const accessChecked = externalAccessChecked ?? true;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isIdle, setIsIdle] = useState(false);

  // Refs for timestamp-based tracking
  const clockedInAtRef = useRef<number | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const isIdleRef = useRef(false);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const displayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleStartTimeRef = useRef<number | null>(null);

  // Computed active seconds based on elapsed time - session_start timestamp
  const getElapsedSeconds = useCallback(() => {
    if (!clockedInAtRef.current) return 0;
    return Math.floor((Date.now() - clockedInAtRef.current) / 1000);
  }, []);

  const getActiveSeconds = useCallback(() => {
    const elapsed = getElapsedSeconds();
    return Math.max(0, elapsed - idleSeconds);
  }, [getElapsedSeconds, idleSeconds]);

  // Force re-render for display updates
  const [, setTick] = useState(0);

  // Reset idle timer on activity
  const resetIdleTimer = useCallback(() => {
    if (!isClockedIn) return;

    lastActivityTimeRef.current = Date.now();

    // If was idle, add idle time and mark as active
    if (isIdleRef.current && idleStartTimeRef.current) {
      const idleDuration = Math.floor((Date.now() - idleStartTimeRef.current) / 1000);
      setIdleSeconds((prev) => prev + idleDuration);
      idleStartTimeRef.current = null;
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

    // Clear and reset the idle timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    idleTimeoutRef.current = setTimeout(() => {
      if (!isClockedIn || document.hidden) return;
      
      idleStartTimeRef.current = Date.now();
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
  }, [isClockedIn, sessionId, user]);

  // Handle visibility change
  useEffect(() => {
    if (!hasAccess || !isClockedIn) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden - if idle, commit the idle time so far
        if (isIdleRef.current && idleStartTimeRef.current) {
          const idleDuration = Math.floor((Date.now() - idleStartTimeRef.current) / 1000);
          setIdleSeconds((prev) => prev + idleDuration);
          idleStartTimeRef.current = null;
        }
        
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
            action_name: "Tab hidden (counting as active)",
          }]).then(() => {});
        }
      } else {
        // Tab visible again - reset activity and restart idle detection
        lastActivityTimeRef.current = Date.now();
        isIdleRef.current = false;
        setIsIdle(false);
        idleStartTimeRef.current = null;
        
        resetIdleTimer();
        
        if (sessionId && user) {
          supabase.from("session_activity_log").insert([{
            session_id: sessionId,
            user_id: user.id,
            activity_type: "tab_visible",
            route: window.location.pathname,
            action_name: "Tab visible",
          }]).then(() => {});
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasAccess, isClockedIn, sessionId, user, resetIdleTimer]);

  // Activity event listeners
  useEffect(() => {
    if (!hasAccess || !isClockedIn) return;

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click", "wheel"];
    
    let lastReset = 0;
    const throttledReset = () => {
      if (document.hidden) return;
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
  }, [hasAccess, isClockedIn, resetIdleTimer]);

  // Display update interval - just triggers re-render for timestamp-based display
  useEffect(() => {
    if (!hasAccess || !isClockedIn) {
      if (displayIntervalRef.current) {
        clearInterval(displayIntervalRef.current);
        displayIntervalRef.current = null;
      }
      return;
    }

    displayIntervalRef.current = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => {
      if (displayIntervalRef.current) {
        clearInterval(displayIntervalRef.current);
      }
    };
  }, [hasAccess, isClockedIn]);

  // Load state: First try database for active session, fallback to localStorage
  useEffect(() => {
    if (!accessChecked || !hasAccess || !user) {
      if (accessChecked) setIsLoading(false);
      return;
    }

    const loadSession = async () => {
      try {
        // Query for the most recent active session
        const { data: activeSessions, error } = await supabase
          .from("user_work_sessions")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("session_start", { ascending: false });

        if (error) throw error;

        if (activeSessions && activeSessions.length > 0) {
          const mostRecent = activeSessions[0];
          
          // Close any older duplicate active sessions
          if (activeSessions.length > 1) {
            const olderSessionIds = activeSessions.slice(1).map((s) => s.id);
            await supabase
              .from("user_work_sessions")
              .update({
                is_active: false,
                session_end: new Date().toISOString(),
              })
              .in("id", olderSessionIds);
            console.log(`Closed ${olderSessionIds.length} duplicate active sessions`);
          }

          // Resume the most recent active session
          const sessionStart = new Date(mostRecent.session_start).getTime();
          const storedIdleSeconds = mostRecent.total_idle_seconds || 0;

          // Check localStorage for any additional idle time since last sync
          const savedState = localStorage.getItem(STORAGE_KEY);
          let additionalIdleSeconds = 0;
          if (savedState) {
            try {
              const state: StoredState = JSON.parse(savedState);
              if (state.sessionId === mostRecent.id && state.wasIdleAtLastSync) {
                // User was idle when app closed, add that time
                additionalIdleSeconds = Math.floor((Date.now() - state.lastSyncAt) / 1000);
              }
            } catch (e) {
              console.error("Error parsing localStorage:", e);
            }
          }

          setSessionId(mostRecent.id);
          setIdleSeconds(storedIdleSeconds + additionalIdleSeconds);
          setIsClockedIn(true);
          setIsIdle(false);
          isIdleRef.current = false;
          clockedInAtRef.current = sessionStart;
          lastActivityTimeRef.current = Date.now();

          console.log(`Resumed session from ${new Date(sessionStart).toLocaleTimeString()}`);
        }
      } catch (e) {
        console.error("Error loading session:", e);
      }
      setIsLoading(false);
    };

    loadSession();
  }, [accessChecked, hasAccess, user]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (!hasAccess || !isClockedIn) return;

    const state: StoredState = {
      sessionId,
      clockedInAt: clockedInAtRef.current,
      idleSeconds,
      lastSyncAt: Date.now(),
      wasIdleAtLastSync: isIdleRef.current,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hasAccess, sessionId, idleSeconds, isClockedIn]);

  // Sync to database periodically
  useEffect(() => {
    if (!hasAccess || !isClockedIn || !sessionId) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    const syncToDatabase = async () => {
      // Get current idle seconds including any ongoing idle period
      let currentIdleSeconds = idleSeconds;
      if (isIdleRef.current && idleStartTimeRef.current) {
        currentIdleSeconds += Math.floor((Date.now() - idleStartTimeRef.current) / 1000);
      }

      const activeSeconds = Math.max(0, getElapsedSeconds() - currentIdleSeconds);

      try {
        await supabase
          .from("user_work_sessions")
          .update({
            total_active_seconds: activeSeconds,
            total_idle_seconds: currentIdleSeconds,
          })
          .eq("id", sessionId);
      } catch (e) {
        console.error("Error syncing session:", e);
      }
    };

    // Sync immediately
    syncToDatabase();

    syncIntervalRef.current = setInterval(syncToDatabase, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [hasAccess, isClockedIn, sessionId, idleSeconds, getElapsedSeconds]);

  // Handle page unload
  useEffect(() => {
    if (!hasAccess || !isClockedIn || !sessionId) return;

    const handleBeforeUnload = () => {
      let currentIdleSeconds = idleSeconds;
      if (isIdleRef.current && idleStartTimeRef.current) {
        currentIdleSeconds += Math.floor((Date.now() - idleStartTimeRef.current) / 1000);
      }

      const state: StoredState = {
        sessionId,
        clockedInAt: clockedInAtRef.current,
        idleSeconds: currentIdleSeconds,
        lastSyncAt: Date.now(),
        wasIdleAtLastSync: isIdleRef.current,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasAccess, isClockedIn, sessionId, idleSeconds]);

  // Log activity helper
  const logActivity = useCallback(
    async (
      activityType: string,
      route: string,
      actionName?: string,
      metadata?: object
    ) => {
      if (!hasAccess || !sessionId || !user) return;

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
    [hasAccess, sessionId, user]
  );

  // Clock in - checks for existing active session first
  const clockIn = useCallback(
    async (type: "auto" | "manual" = "manual") => {
      if (!hasAccess || !user || isClockedIn) return;

      try {
        // Check if there's already an active session
        const { data: existingSession } = await supabase
          .from("user_work_sessions")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("session_start", { ascending: false })
          .limit(1)
          .single();

        if (existingSession) {
          // Resume existing session instead of creating new one
          const sessionStart = new Date(existingSession.session_start).getTime();
          setSessionId(existingSession.id);
          setIdleSeconds(existingSession.total_idle_seconds || 0);
          setIsClockedIn(true);
          setIsIdle(false);
          isIdleRef.current = false;
          clockedInAtRef.current = sessionStart;
          lastActivityTimeRef.current = Date.now();
          console.log("Resumed existing active session");
          return;
        }

        // Create new session
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
        setIdleSeconds(0);
        setIsClockedIn(true);
        setIsIdle(false);
        isIdleRef.current = false;
        clockedInAtRef.current = now;
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
    [hasAccess, user, isClockedIn]
  );

  // Clock out
  const clockOut = useCallback(async () => {
    if (!hasAccess || !sessionId || !user) return;

    try {
      // Commit any ongoing idle time
      let finalIdleSeconds = idleSeconds;
      if (isIdleRef.current && idleStartTimeRef.current) {
        finalIdleSeconds += Math.floor((Date.now() - idleStartTimeRef.current) / 1000);
      }

      const finalActiveSeconds = Math.max(0, getElapsedSeconds() - finalIdleSeconds);

      await supabase
        .from("user_work_sessions")
        .update({
          session_end: new Date().toISOString(),
          total_active_seconds: finalActiveSeconds,
          total_idle_seconds: finalIdleSeconds,
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
      setIdleSeconds(0);
      setIsClockedIn(false);
      setIsIdle(false);
      isIdleRef.current = false;
      clockedInAtRef.current = null;
      idleStartTimeRef.current = null;
      localStorage.removeItem(STORAGE_KEY);
      
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
    } catch (e) {
      console.error("Error clocking out:", e);
    }
  }, [hasAccess, sessionId, user, idleSeconds, getElapsedSeconds]);

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

  // Get current idle including any ongoing idle period
  const getCurrentIdleSeconds = useCallback(() => {
    let total = idleSeconds;
    if (isIdleRef.current && idleStartTimeRef.current) {
      total += Math.floor((Date.now() - idleStartTimeRef.current) / 1000);
    }
    return total;
  }, [idleSeconds]);

  const activeSeconds = getActiveSeconds();
  const currentIdleSeconds = getCurrentIdleSeconds();
  const currentEarnings = calculateEarnings(activeSeconds);

  return {
    isTargetUser: hasAccess,
    isLoading,
    isClockedIn,
    isIdle,
    activeSeconds,
    idleSeconds: currentIdleSeconds,
    formattedTime: formatTime(activeSeconds),
    formattedIdleTime: formatTime(currentIdleSeconds),
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
