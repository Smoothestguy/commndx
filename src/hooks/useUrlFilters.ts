import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";

/**
 * Hook to persist filter state in URL query parameters.
 * Filters survive page refreshes and navigation.
 */
export function useUrlFilters<T extends Record<string, string | undefined>>(
  defaultValues: T
): {
  filters: T;
  setFilter: (key: keyof T, value: string | undefined) => void;
  setFilters: (newFilters: Partial<T>) => void;
  clearFilters: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();

  // Build current filters from URL, falling back to defaults
  const filters = useMemo(() => {
    const result = { ...defaultValues };
    for (const key of Object.keys(defaultValues)) {
      const urlValue = searchParams.get(key);
      if (urlValue !== null && urlValue !== "") {
        (result as Record<string, string | undefined>)[key] = urlValue;
      }
    }
    return result;
  }, [searchParams, defaultValues]);

  // Update a single filter
  const setFilter = useCallback(
    (key: keyof T, value: string | undefined) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        if (value === undefined || value === "" || value === "all") {
          newParams.delete(key as string);
        } else {
          newParams.set(key as string, value);
        }
        return newParams;
      }, { replace: true });
    },
    [setSearchParams]
  );

  // Update multiple filters at once
  const setFilters = useCallback(
    (newFilters: Partial<T>) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(newFilters)) {
          if (value === undefined || value === "" || value === "all") {
            newParams.delete(key);
          } else {
            newParams.set(key, value as string);
          }
        }
        return newParams;
      }, { replace: true });
    },
    [setSearchParams]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return { filters, setFilter, setFilters, clearFilters };
}
