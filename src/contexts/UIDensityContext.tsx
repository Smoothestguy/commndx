import { createContext, useContext, ReactNode, useMemo } from "react";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";

type UIDensity = "normal" | "spreadsheet" | "2k1";

interface UIDensityContextType {
  density: UIDensity;
  isSpreadsheetMode: boolean;
  is2K1Mode: boolean;
  /** True for either 2K1 or spreadsheet - any compact density mode */
  isCompactMode: boolean;
  isLoading: boolean;
}

const UIDensityContext = createContext<UIDensityContextType>({
  density: "normal",
  isSpreadsheetMode: false,
  is2K1Mode: false,
  isCompactMode: false,
  isLoading: true,
});

export function UIDensityProvider({ children }: { children: ReactNode }) {
  const { activeTheme, isLoading } = useDashboardConfig();
  
  const value = useMemo(() => {
    const density = activeTheme?.density ?? "normal";
    const isSpreadsheetMode = density === "spreadsheet";
    const is2K1Mode = density === "2k1";
    return {
      density,
      isSpreadsheetMode,
      is2K1Mode,
      isCompactMode: isSpreadsheetMode || is2K1Mode,
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
