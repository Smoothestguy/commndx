import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

/**
 * useState that survives unmounting for the browser session (per key), so a
 * screen's filters/selection are preserved when flipping workspace tabs.
 */
export function useSessionState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = `ss:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setValue((prev) => {
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try { sessionStorage.setItem(storageKey, JSON.stringify(resolved)); } catch { /* ignore */ }
      return resolved;
    });
  }, [storageKey]);
  return [value, set];
}
