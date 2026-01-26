import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { DEFAULT_HOURLY_RATE } from "@/utils/sessionTime";

const STORAGE_KEY = "session_tracking_state";
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity = idle
const SYNC_INTERVAL_MS = 30 * 1000; // Sync to DB every 30 seconds
const PRIMARY_TAB_HEARTBEAT_MS = 2000; // Heartbeat for primary tab claim
const PRIMARY_TAB_STORAGE_KEY = "session_tracking_primary_tab";

interface StoredState {
  sessionId: string | null;
  clockedInAt: number | null;
  idleSeconds: number;
  lastSyncAt: number;
  wasIdleAtLastSync: boolean;
  idleCorrectionVersion: number;
}

interface PrimaryTabState {
  tabId: string;
  lastHeartbeat: number;
}

export function useSessionTracking(externalHasAccess?: boolean, externalAccessChecked?: boolean) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  // Use external access state if provided, otherwise default to false
  const hasAccess = externalHasAccess ?? false;
  const accessChecked = externalAccessChecked ?? true;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isIdle, setIsIdle] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number>(DEFAULT_HOURLY_RATE);

  // Refs for timestamp-based tracking
  const clockedInAtRef = useRef<number | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const isIdleRef = useRef(false);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const displayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleStartTimeRef = useRef<number | null>(null);
  const idleCorrectionVersionRef = useRef<number>(0);
  
  // CRITICAL: Use ref for session ID to prevent stale closures in timeout callbacks
  // This fixes race condition where idle events are logged to wrong session after clock-out/clock-in
  const sessionIdRef = useRef<string | null>(null);
  const isClockedInRef = useRef(false);
  
  // Cross-tab coordination refs
  const tabIdRef = useRef<string>(`tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const isPrimaryTabRef = useRef(false);
  const hasLoggedIdleStartRef = useRef(false); // Prevent duplicate idle_start events

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

  // Check if this tab is the primary tab for idle tracking
  const checkIsPrimaryTab = useCallback(() => {
    const stored = localStorage.getItem(PRIMARY_TAB_STORAGE_KEY);
    if (stored) {
      try {
        const state: PrimaryTabState = JSON.parse(stored);
        // If stored heartbeat is more than 3x the interval, consider it stale
        if (Date.now() - state.lastHeartbeat > PRIMARY_TAB_HEARTBEAT_MS * 3) {
          // Claim primary status
          isPrimaryTabRef.current = true;
          localStorage.setItem(PRIMARY_TAB_STORAGE_KEY, JSON.stringify({
            tabId: tabIdRef.current,
            lastHeartbeat: Date.now(),
          }));
          return true;
        }
        isPrimaryTabRef.current = state.tabId === tabIdRef.current;
        return isPrimaryTabRef.current;
      } catch {
        // Invalid state, claim it
        isPrimaryTabRef.current = true;
        localStorage.setItem(PRIMARY_TAB_STORAGE_KEY, JSON.stringify({
          tabId: tabIdRef.current,
          lastHeartbeat: Date.now(),
        }));
        return true;
      }
    }
    // No primary tab, claim it
    isPrimaryTabRef.current = true;
    localStorage.setItem(PRIMARY_TAB_STORAGE_KEY, JSON.stringify({
      tabId: tabIdRef.current,
      lastHeartbeat: Date.now(),
    }));
    return true;
  }, []);

  // Reset idle timer on activity
  const resetIdleTimer = useCallback(() => {
    // Use ref to check clocked-in state to avoid stale closures
    if (!isClockedInRef.current) return;

    lastActivityTimeRef.current = Date.now();

    // If was idle, add idle time and mark as active
    if (isIdleRef.current && idleStartTimeRef.current) {
      const idleDuration = Math.floor((Date.now() - idleStartTimeRef.current) / 1000);
      setIdleSeconds((prev) => prev + idleDuration);
      idleStartTimeRef.current = null;
      isIdleRef.current = false;
      setIsIdle(false);
      hasLoggedIdleStartRef.current = false; // Reset the guard

      // Use sessionIdRef to prevent logging to wrong session
      const currentSessionId = sessionIdRef.current;
      if (currentSessionId && user && isPrimaryTabRef.current) {
        supabase.from("session_activity_log").insert([{
          session_id: currentSessionId,
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
      // CRITICAL: Use refs to check current state, not stale closure values
      if (!isClockedInRef.current || document.hidden) return;
      
      // Get current session ID from ref
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) return; // Guard: no valid session
      
      // Only log idle_start if we're the primary tab AND haven't already logged it
      if (!isPrimaryTabRef.current || hasLoggedIdleStartRef.current) {
        // Still mark as idle locally for UI purposes
        idleStartTimeRef.current = Date.now();
        isIdleRef.current = true;
        setIsIdle(true);
        return;
      }
      
      hasLoggedIdleStartRef.current = true;
      idleStartTimeRef.current = Date.now();
      isIdleRef.current = true;
      setIsIdle(true);
      
      if (user) {
        supabase.from("session_activity_log").insert([{
          session_id: currentSessionId,
          user_id: user.id,
          activity_type: "idle_start",
          route: window.location.pathname,
          action_name: "User became idle (5 min no activity)",
        }]).then(() => {});
      }
    }, IDLE_TIMEOUT_MS);
  }, [user]); // Removed isClockedIn and sessionId - use refs instead

  // Primary tab heartbeat - maintain primary status
  useEffect(() => {
    if (!hasAccess || !isClockedIn) return;

    // Try to claim primary on mount
    checkIsPrimaryTab();

    const heartbeatInterval = setInterval(() => {
      if (isPrimaryTabRef.current) {
        localStorage.setItem(PRIMARY_TAB_STORAGE_KEY, JSON.stringify({
          tabId: tabIdRef.current,
          lastHeartbeat: Date.now(),
        }));
      } else {
        // Check if we should take over
        checkIsPrimaryTab();
      }
    }, PRIMARY_TAB_HEARTBEAT_MS);

    // Listen for storage changes (cross-tab communication)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PRIMARY_TAB_STORAGE_KEY && e.newValue) {
        try {
          const state: PrimaryTabState = JSON.parse(e.newValue);
          isPrimaryTabRef.current = state.tabId === tabIdRef.current;
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener("storage", handleStorageChange);
      // If we were primary, clear it so another tab can take over
      if (isPrimaryTabRef.current) {
        localStorage.removeItem(PRIMARY_TAB_STORAGE_KEY);
      }
    };
  }, [hasAccess, isClockedIn, checkIsPrimaryTab]);

  // Handle visibility change AND window blur/focus
  // When tab is hidden OR window loses focus, stop idle accumulation
  useEffect(() => {
    if (!hasAccess || !isClockedIn) return;

    const commitIdleAndPause = (eventType: string) => {
      // If currently idle, commit the idle time so far
      if (isIdleRef.current && idleStartTimeRef.current) {
        const idleDuration = Math.floor((Date.now() - idleStartTimeRef.current) / 1000);
        setIdleSeconds((prev) => prev + idleDuration);
        idleStartTimeRef.current = null;
        isIdleRef.current = false;
        setIsIdle(false);
      }
      
      // Clear the idle timeout - don't accumulate idle while unfocused
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
      
      // Use sessionIdRef to prevent logging to wrong session
      const currentSessionId = sessionIdRef.current;
      if (currentSessionId && user) {
        supabase.from("session_activity_log").insert([{
          session_id: currentSessionId,
          user_id: user.id,
          activity_type: eventType,
          route: window.location.pathname,
          action_name: `${eventType} (pausing idle detection)`,
        }]).then(() => {});
      }
    };

    const resumeIdleDetection = (eventType: string) => {
      // Reset activity and restart idle detection
      lastActivityTimeRef.current = Date.now();
      isIdleRef.current = false;
      setIsIdle(false);
      idleStartTimeRef.current = null;
      
      resetIdleTimer();
      
      // Use sessionIdRef to prevent logging to wrong session
      const currentSessionId = sessionIdRef.current;
      if (currentSessionId && user) {
        supabase.from("session_activity_log").insert([{
          session_id: currentSessionId,
          user_id: user.id,
          activity_type: eventType,
          route: window.location.pathname,
          action_name: `${eventType} (resuming idle detection)`,
        }]).then(() => {});
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        commitIdleAndPause("tab_hidden");
      } else {
        resumeIdleDetection("tab_visible");
      }
    };

    const handleWindowBlur = () => {
      // Window lost focus (user switched to another app)
      commitIdleAndPause("window_blur");
    };

    const handleWindowFocus = () => {
      // Window regained focus
      resumeIdleDetection("window_focus");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
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
  // Also fetch the user's hourly rate from personnel table
  useEffect(() => {
    if (!accessChecked || !hasAccess || !user) {
      if (accessChecked) setIsLoading(false);
      return;
    }

    const loadSession = async () => {
      try {
        // Fetch hourly rate from personnel table
        const { data: personnelData } = await supabase
          .from("personnel")
          .select("hourly_rate")
          .eq("user_id", user.id)
          .maybeSingle();

        if (personnelData?.hourly_rate) {
          setHourlyRate(Number(personnelData.hourly_rate));
        }

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
          const serverCorrectionVersion = (mostRecent as { idle_correction_version?: number }).idle_correction_version || 0;

          // Use the database value directly - localStorage was causing double-counting
          // The database already has the correct idle time from the last sync before page closed
          setSessionId(mostRecent.id);
          sessionIdRef.current = mostRecent.id; // Keep ref in sync
          setIdleSeconds(storedIdleSeconds);
          setIsClockedIn(true);
          isClockedInRef.current = true; // Keep ref in sync
          setIsIdle(false);
          isIdleRef.current = false;
          clockedInAtRef.current = sessionStart;
          lastActivityTimeRef.current = Date.now();
          idleCorrectionVersionRef.current = serverCorrectionVersion;

          console.log(`Resumed session from ${new Date(sessionStart).toLocaleTimeString()}, correction version: ${serverCorrectionVersion}`);
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
      idleCorrectionVersion: idleCorrectionVersionRef.current,
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
      const elapsedSeconds = getElapsedSeconds();
      
      // FIRST: Check if server has a newer correction version
      // If so, adopt server's idle time and don't overwrite it
      try {
        const { data: serverSession } = await supabase
          .from("user_work_sessions")
          .select("total_idle_seconds, idle_correction_version")
          .eq("id", sessionId)
          .single();
        
        if (serverSession) {
          const serverVersion = (serverSession as { idle_correction_version?: number }).idle_correction_version || 0;
          if (serverVersion > idleCorrectionVersionRef.current) {
            // Server was corrected! Adopt the server's idle time
            console.log(`Server correction detected: v${idleCorrectionVersionRef.current} -> v${serverVersion}, adopting server idle: ${serverSession.total_idle_seconds}s`);
            setIdleSeconds(serverSession.total_idle_seconds || 0);
            idleCorrectionVersionRef.current = serverVersion;
            // Reset any ongoing idle period to prevent re-inflation
            if (isIdleRef.current && idleStartTimeRef.current) {
              idleStartTimeRef.current = Date.now();
            }
            return; // Skip this sync cycle, next one will use correct values
          }
        }
      } catch (e) {
        console.error("Error checking server correction:", e);
      }
      
      // Get current idle seconds including any ongoing idle period
      let currentIdleSeconds = idleSeconds;
      if (isIdleRef.current && idleStartTimeRef.current) {
        currentIdleSeconds += Math.floor((Date.now() - idleStartTimeRef.current) / 1000);
      }

      // SANITY CAP: Idle can never exceed elapsed time
      // This prevents runaway totals if state gets out of sync
      currentIdleSeconds = Math.min(currentIdleSeconds, Math.max(0, elapsedSeconds - 1));

      const activeSeconds = Math.max(0, elapsedSeconds - currentIdleSeconds);

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
        idleCorrectionVersion: idleCorrectionVersionRef.current,
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
        // CRITICAL: Clear any pending idle timeout from previous session
        // This prevents stale closures from logging events to wrong session
        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current);
          idleTimeoutRef.current = null;
        }
        
        // Reset idle state to prevent carryover
        hasLoggedIdleStartRef.current = false;
        isIdleRef.current = false;
        idleStartTimeRef.current = null;
        
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
          sessionIdRef.current = existingSession.id; // Keep ref in sync
          setIdleSeconds(existingSession.total_idle_seconds || 0);
          setIsClockedIn(true);
          isClockedInRef.current = true; // Keep ref in sync
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
        sessionIdRef.current = data.id; // Keep ref in sync
        setIdleSeconds(0);
        setIsClockedIn(true);
        isClockedInRef.current = true; // Keep ref in sync
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

      // CRITICAL: Update refs BEFORE clearing timeout to prevent race condition
      // Any pending timeout callbacks will see these values
      sessionIdRef.current = null;
      isClockedInRef.current = false;
      
      setSessionId(null);
      setIdleSeconds(0);
      setIsClockedIn(false);
      setIsIdle(false);
      isIdleRef.current = false;
      clockedInAtRef.current = null;
      idleStartTimeRef.current = null;
      hasLoggedIdleStartRef.current = false;
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
    return (seconds / 3600) * hourlyRate;
  }, [hourlyRate]);

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
    hourlyRate,
    currentEarnings,
    formattedEarnings: formatCurrency(currentEarnings),
    calculateEarnings,
    formatTime,
  };
}
