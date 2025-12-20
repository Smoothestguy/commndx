import { useState, useEffect, useCallback, useRef } from "react";

interface UseIdleDetectionOptions {
  idleTimeoutMs?: number; // Default 5 minutes
  onIdleStart?: () => void;
  onIdleEnd?: () => void;
  enabled?: boolean;
}

export function useIdleDetection({
  idleTimeoutMs = 5 * 60 * 1000, // 5 minutes
  onIdleStart,
  onIdleEnd,
  enabled = true,
}: UseIdleDetectionOptions = {}) {
  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isIdleRef = useRef(false);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // If user was idle, mark as active again
    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
      onIdleEnd?.();
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      isIdleRef.current = true;
      setIsIdle(true);
      onIdleStart?.();
    }, idleTimeoutMs);
  }, [idleTimeoutMs, onIdleStart, onIdleEnd, enabled]);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    // Events that indicate user activity
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "wheel",
    ];

    // Throttle to avoid too many resets
    let lastReset = 0;
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastReset > 1000) {
        // Max once per second
        lastReset = now;
        resetTimer();
      }
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, throttledReset, { passive: true });
    });

    // Initial timer start
    resetTimer();

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledReset);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [resetTimer, enabled]);

  // Handle visibility change (tab hidden = pause)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, treat as idle
        if (!isIdleRef.current) {
          isIdleRef.current = true;
          setIsIdle(true);
          onIdleStart?.();
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      } else {
        // Tab is visible again, reset timer
        resetTimer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, onIdleStart, resetTimer]);

  return {
    isIdle,
    resetTimer,
  };
}
