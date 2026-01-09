import { createContext, useContext, ReactNode, useMemo } from "react";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";

type UIDensity = "normal" | "spreadsheet";

interface UIDensityContextType {
  density: UIDensity;
  isSpreadsheetMode: boolean;
  isLoading: boolean;
}

const UIDensityContext = createContext<UIDensityContextType>({
  density: "normal",
  isSpreadsheetMode: false,
  isLoading: true,
});

export function UIDensityProvider({ children }: { children: ReactNode }) {
  const { activeTheme, isLoading } = useDashboardConfig();
  
  const value = useMemo(() => {
    const density = activeTheme?.density ?? "normal";
    return {
      density,
      isSpreadsheetMode: density === "spreadsheet",
      isLoading,
    };
  }, [activeTheme?.density, isLoading]);

  return (
    <UIDensityContext.Provider value={value}>
      {children}
    </UIDensityContext.Provider>
  );
}

export function useUIDensity() {
  return useContext(UIDensityContext);
}
