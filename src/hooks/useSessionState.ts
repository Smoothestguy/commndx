import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

/**
 * useState that survives unmounting for the browser session (per key), so a
 * screen's filters/selection are preserved when flipping workspace tabs.
 */
export function useSessionState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = `ss:${key}`;
  const read = () => {
    try { const raw = sessionStorage.getItem(storageKey); return raw != null ? JSON.parse(raw) as T : initial; } catch { return initial; }
  };
  const [state, setState] = useState<{ key: string; value: T }>(() => ({ key: storageKey, value: read() }));
  const value = state.key === storageKey ? state.value : read();
  const set = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setState(prev => {
      const current = prev.key === storageKey ? prev.value : read();
      const resolved = typeof next === "function" ? (next as (p: T) => T)(current) : next;
      try { sessionStorage.setItem(storageKey, JSON.stringify(resolved)); } catch { /* unavailable storage */ }
      return { key: storageKey, value: resolved };
    });
  }, [storageKey]);
  return [value, set];
}
