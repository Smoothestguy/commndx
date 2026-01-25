import { useState, useEffect, useCallback } from "react";
import type { PersonnelColumnConfig } from "./types";
import { PERSONNEL_COLUMNS } from "./types";

const STORAGE_KEY = "personnel-column-preferences";

export function useColumnPreferences() {
  const [columns, setColumns] = useState<PersonnelColumnConfig[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, boolean>;
        return PERSONNEL_COLUMNS.map((col) => ({
          ...col,
          visible: parsed[col.key] ?? col.defaultVisible,
        }));
      }
    } catch (e) {
      console.error("Failed to parse column preferences:", e);
    }
    return PERSONNEL_COLUMNS.map((col) => ({
      ...col,
      visible: col.defaultVisible,
    }));
  });

  const updateColumns = useCallback((newColumns: PersonnelColumnConfig[]) => {
    setColumns(newColumns);
    try {
      const prefs = newColumns.reduce((acc, col) => {
        acc[col.key] = col.visible;
        return acc;
      }, {} as Record<string, boolean>);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.error("Failed to save column preferences:", e);
    }
  }, []);

  return { columns, setColumns: updateColumns };
}
