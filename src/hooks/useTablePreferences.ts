import { useState, useCallback, useEffect } from 'react';

export interface TablePreferences {
  visibleColumns: string[];
  columnOrder: string[];
  sortKey: string | null;
  sortDirection: 'asc' | 'desc';
  columnFilters: Record<string, string>;
}

interface UseTablePreferencesOptions {
  tableId: string;
  defaultColumns: string[];
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
}

const getStorageKey = (tableId: string) => `table-prefs-${tableId}`;

export function useTablePreferences({
  tableId,
  defaultColumns,
  defaultSortKey = null,
  defaultSortDirection = 'asc',
}: UseTablePreferencesOptions) {
  const [preferences, setPreferences] = useState<TablePreferences>(() => {
    const stored = localStorage.getItem(getStorageKey(tableId));
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Ensure all default columns are included in case new columns were added
        const visibleColumns = parsed.visibleColumns || defaultColumns;
        const columnOrder = parsed.columnOrder || defaultColumns;
        return {
          visibleColumns,
          columnOrder,
          sortKey: parsed.sortKey ?? defaultSortKey,
          sortDirection: parsed.sortDirection || defaultSortDirection,
          columnFilters: parsed.columnFilters || {},
        };
      } catch {
        // Invalid stored data, use defaults
      }
    }
    return {
      visibleColumns: defaultColumns,
      columnOrder: defaultColumns,
      sortKey: defaultSortKey,
      sortDirection: defaultSortDirection,
      columnFilters: {},
    };
  });

  // Persist to localStorage whenever preferences change
  useEffect(() => {
    localStorage.setItem(getStorageKey(tableId), JSON.stringify(preferences));
  }, [tableId, preferences]);

  const setSort = useCallback((key: string) => {
    setPreferences(prev => ({
      ...prev,
      sortKey: key,
      sortDirection: prev.sortKey === key && prev.sortDirection === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const setSortDirection = useCallback((direction: 'asc' | 'desc') => {
    setPreferences(prev => ({ ...prev, sortDirection: direction }));
  }, []);

  const toggleColumnVisibility = useCallback((columnKey: string) => {
    setPreferences(prev => {
      const isVisible = prev.visibleColumns.includes(columnKey);
      return {
        ...prev,
        visibleColumns: isVisible
          ? prev.visibleColumns.filter(k => k !== columnKey)
          : [...prev.visibleColumns, columnKey],
      };
    });
  }, []);

  const setColumnOrder = useCallback((newOrder: string[]) => {
    setPreferences(prev => ({ ...prev, columnOrder: newOrder }));
  }, []);

  const setColumnFilter = useCallback((columnKey: string, value: string) => {
    setPreferences(prev => ({
      ...prev,
      columnFilters: {
        ...prev.columnFilters,
        [columnKey]: value,
      },
    }));
  }, []);

  const clearColumnFilter = useCallback((columnKey: string) => {
    setPreferences(prev => {
      const { [columnKey]: _, ...rest } = prev.columnFilters;
      return { ...prev, columnFilters: rest };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setPreferences(prev => ({ ...prev, columnFilters: {} }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setPreferences({
      visibleColumns: defaultColumns,
      columnOrder: defaultColumns,
      sortKey: defaultSortKey,
      sortDirection: defaultSortDirection,
      columnFilters: {},
    });
  }, [defaultColumns, defaultSortKey, defaultSortDirection]);

  const hasActiveFilters = Object.values(preferences.columnFilters).some(v => v.length > 0);

  return {
    preferences,
    setSort,
    setSortDirection,
    toggleColumnVisibility,
    setColumnOrder,
    setColumnFilter,
    clearColumnFilter,
    clearAllFilters,
    resetToDefaults,
    hasActiveFilters,
  };
}
