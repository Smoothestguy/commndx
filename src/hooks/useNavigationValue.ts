import { useSearchParams } from 'react-router-dom';
import { navigationValue, withSearchValue } from '@/lib/navigationState';

/** URL wins over defaults; choices push history and typing explicitly replaces it. */
export function useNavigationValue<T extends string>(key: string, fallback: T, choices?: readonly T[]) {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value = navigationValue(raw, fallback, choices);
  const setValue = (next: T, replace = false) => setParams(prev => withSearchValue(prev.toString(), key, next), { replace });
  return [value, setValue] as const;
}