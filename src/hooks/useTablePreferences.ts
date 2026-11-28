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
  /** Every column key, in display order. Always drives columnOrder and the Columns menu. */
  defaultColumns: string[];
  /** Keys shown on first load. Defaults to defaultColumns; keeps default-hidden columns out of view. */
  defaultVisible?: string[];
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
}

const getStorageKey = (tableId: string) => `table-prefs-${tableId}`;

export interface ResolvedTablePreferencesInput {
  /** Raw localStorage value for the table, or null when none has been saved yet. */
  stored: string | null;
  defaultColumns: string[];
  defaultVisible?: string[];
  defaultSortKey?: string | null;
  defaultSortDirection?: 'asc' | 'desc';
}

/**
 * Pure merge of a saved layout with the current column set.
 * columnOrder always carries every column (so the Columns menu and drag-order stay complete),
 * while a column added after the layout was saved only becomes visible when it is not default-hidden.
 */
export function resolveTablePreferences({
  stored,
  defaultColumns,
  defaultVisible,
  defaultSortKey = null,
  defaultSortDirection = 'asc',
}: ResolvedTablePreferencesInput): TablePreferences {
  const initialVisible = defaultVisible ?? defaultColumns;
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Ensure all default columns are included in case new columns were added
      const storedOrder: string[] = parsed.columnOrder || defaultColumns;
      const added = defaultColumns.filter(k => !storedOrder.includes(k));
      // A newly-added column only shows if it is not default-hidden.
      const visibleColumns = [...(parsed.visibleColumns || initialVisible), ...added.filter(k => initialVisible.includes(k))];
      const columnOrder = [...storedOrder, ...added];
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
    visibleColumns: initialVisible,
    columnOrder: defaultColumns,
    sortKey: defaultSortKey,
    sortDirection: defaultSortDirection,
    columnFilters: {},
  };
}

export function useTablePreferences({
  tableId,
  defaultColumns,
  defaultVisible,
  defaultSortKey = null,
  defaultSortDirection = 'asc',
}: UseTablePreferencesOptions) {
  const initialVisible = defaultVisible ?? defaultColumns;
  const [preferences, setPreferences] = useState<TablePreferences>(() =>
    resolveTablePreferences({
      stored: localStorage.getItem(getStorageKey(tableId)),
      defaultColumns,
      defaultVisible,
      defaultSortKey,
      defaultSortDirection,
    }),
  );

  // Persist to localStorage whenever preferences change
  useEffect(() => {
    localStorage.setItem(getStorageKey(tableId), JSON.stringify(preferences));
  }, [tableId, preferences]);

  const setSort = useCallback((key: string, direction?: 'asc' | 'desc') => {
    setPreferences(prev => ({
      ...prev,
      sortKey: key,
      sortDirection: direction ?? (prev.sortKey === key && prev.sortDirection === 'asc' ? 'desc' : 'asc'),
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
      visibleColumns: initialVisible,
      columnOrder: defaultColumns,
      sortKey: defaultSortKey,
      sortDirection: defaultSortDirection,
      columnFilters: {},
    });
  }, [defaultColumns, defaultVisible, defaultSortKey, defaultSortDirection]);

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
