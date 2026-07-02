import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Tracks an internal history stack so we can render Back/Forward buttons
 * with reliable enabled/disabled state (browser history length is unreliable).
 *
 * We only intercept navigations that arrive via <Link>/navigate() PUSH.
 * When the user clicks our own Back/Forward buttons we mark the change so we
 * don't double-record it.
 */
export function useNavigationHistory() {
  const location = useLocation();
  const navigate = useNavigate();

  const stackRef = useRef<string[]>([location.pathname + location.search]);
  const indexRef = useRef(0);
  const internalNavRef = useRef(false);

  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  useEffect(() => {
    const current = location.pathname + location.search;
    if (internalNavRef.current) {
      internalNavRef.current = false;
      return;
    }
    // Push: drop any forward entries, append current
    const stack = stackRef.current.slice(0, indexRef.current + 1);
    if (stack[stack.length - 1] !== current) {
      stack.push(current);
      // Cap the stack so it doesn't grow unbounded
      if (stack.length > 50) stack.shift();
      stackRef.current = stack;
      indexRef.current = stack.length - 1;
      rerender();
    }
  }, [location.pathname, location.search]);

  const canBack = indexRef.current > 0;
  const canForward = indexRef.current < stackRef.current.length - 1;

  const goBack = () => {
    if (!canBack) return;
    internalNavRef.current = true;
    indexRef.current -= 1;
    navigate(stackRef.current[indexRef.current]);
    rerender();
  };

  const goForward = () => {
    if (!canForward) return;
    internalNavRef.current = true;
    indexRef.current += 1;
    navigate(stackRef.current[indexRef.current]);
    rerender();
  };

  return { canBack, canForward, goBack, goForward };
}
