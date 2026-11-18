import { useEffect, useState } from 'react';

export const SEARCH_DEBOUNCE_MS = 300;

export function scheduleDebouncedValue<T>(value: T, commit: (value: T) => void, delay = SEARCH_DEBOUNCE_MS) {
  const timer = setTimeout(() => commit(value), delay);
  return () => clearTimeout(timer);
}

/** Keep the input immediate; delay only the value used by a server query. */
export function useDebouncedValue<T>(value: T, delay = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => scheduleDebouncedValue(value, setDebounced, delay), [value, delay]);
  return debounced;
}