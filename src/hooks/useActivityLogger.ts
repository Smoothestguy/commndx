import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useSessionTracking } from "./useSessionTracking";

export function useActivityLogger() {
  const location = useLocation();
  const { isTargetUser, isClockedIn, sessionId, logActivity } =
    useSessionTracking();
  const lastRouteRef = useRef<string>("");

  // Log page navigation
  useEffect(() => {
    if (!isTargetUser || !isClockedIn || !sessionId) return;

    // Only log if route actually changed
    if (location.pathname !== lastRouteRef.current) {
      lastRouteRef.current = location.pathname;
      logActivity(
        "page_view",
        location.pathname,
        `Navigated to ${location.pathname}`
      );
    }
  }, [location.pathname, isTargetUser, isClockedIn, sessionId, logActivity]);

  // Function to log custom actions
  const logAction = useCallback(
    (actionName: string, metadata?: Record<string, unknown>) => {
      if (!isTargetUser || !isClockedIn) return;
      logActivity("action", window.location.pathname, actionName, metadata);
    },
    [isTargetUser, isClockedIn, logActivity]
  );

  return {
    logAction,
    isTracking: isTargetUser && isClockedIn,
  };
}
