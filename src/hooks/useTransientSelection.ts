import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocation } from 'react-router-dom';
import { clearLegacySelection } from '@/lib/transientSelection';

/** Row selection lives only in the current screen, including reused route instances. */
export function useTransientSelection<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const { pathname } = useLocation();
  const scope = `${pathname}:${key}`;
  const [state, setState] = useState({ scope, value: initial });
  const value = state.scope === scope ? state.value : initial;
  useEffect(() => {
    const clear = () => {
      try { clearLegacySelection(sessionStorage, key); } catch { /* unavailable */ }
      try { clearLegacySelection(localStorage, key); } catch { /* unavailable */ }
    };
    clear();
    setState({ scope, value: initial });
    return clear;
  }, [scope]);
  const set = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setState(prev => ({ scope, value: typeof next === 'function'
      ? (next as (value: T) => T)(prev.scope === scope ? prev.value : initial) : next }));
  }, [scope]);
  return [value, set];
}