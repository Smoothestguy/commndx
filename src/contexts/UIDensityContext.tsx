import { createContext, useContext, ReactNode, useMemo, useEffect, useCallback } from "react";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";

type UIDensity = "normal" | "spreadsheet" | "2k1";
type SectionDensity = "compact" | "default" | "relaxed";

interface SectionDensityOverride {
  density?: SectionDensity;
  rowHeight?: string;
  spacing?: string;
  fontSize?: string;
}

interface UIDensityContextType {
  density: UIDensity;
  isSpreadsheetMode: boolean;
  is2K1Mode: boolean;
  /** True for either 2K1 or spreadsheet - any compact density mode */
  isCompactMode: boolean;
  isLoading: boolean;
  /** Get CSS class for section-level density override */
  getSectionDensityClass: (override?: SectionDensityOverride) => string;
  /** Get density-aware spacing class */
  getSpacingClass: (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => string;
  /** Get density-aware text size class */
  getTextClass: (size: 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl') => string;
}

const UIDensityContext = createContext<UIDensityContextType>({
  density: "normal",
  isSpreadsheetMode: false,
  is2K1Mode: false,
  isCompactMode: false,
  isLoading: true,
  getSectionDensityClass: () => "",
  getSpacingClass: () => "",
  getTextClass: () => "",
});

export function UIDensityProvider({ children }: { children: ReactNode }) {
  const { activeTheme, isLoading } = useDashboardConfig();
  
  const density = activeTheme?.density ?? "normal";
  const isSpreadsheetMode = density === "spreadsheet";
  const is2K1Mode = density === "2k1";
  const isCompactMode = isSpreadsheetMode || is2K1Mode;
  
  // Apply density class to document root
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all density classes first
    root.classList.remove('density-2k1', 'density-spreadsheet');
    
    // Apply the appropriate density class
    if (is2K1Mode) {
      root.classList.add('density-2k1');
    } else if (isSpreadsheetMode) {
      root.classList.add('density-spreadsheet');
    }
  }, [is2K1Mode, isSpreadsheetMode]);
  
  const getSectionDensityClass = useCallback((override?: SectionDensityOverride): string => {
    if (!override?.density) return "";
    
    switch (override.density) {
      case "compact":
        return "density-section-compact";
      case "relaxed":
        return "density-section-relaxed";
      default:
        return "";
    }
  }, []);
  
  const getSpacingClass = useCallback((size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'): string => {
    // Return Tailwind classes that map to our CSS custom properties
    // These will automatically respond to density changes via CSS
    const spacingMap = {
      xs: 'gap-[var(--density-spacing-xs)]',
      sm: 'gap-[var(--density-spacing-sm)]',
      md: 'gap-[var(--density-spacing-md)]',
      lg: 'gap-[var(--density-spacing-lg)]',
      xl: 'gap-[var(--density-spacing-xl)]',
    };
    return spacingMap[size];
  }, []);
  
  const getTextClass = useCallback((size: 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl'): string => {
    const textMap = {
      xs: 'text-[length:var(--density-font-xs)]',
      sm: 'text-[length:var(--density-font-sm)]',
      base: 'text-[length:var(--density-font-base)]',
      md: 'text-[length:var(--density-font-md)]',
      lg: 'text-[length:var(--density-font-lg)]',
      xl: 'text-[length:var(--density-font-xl)]',
    };
    return textMap[size];
  }, []);
  
  const value = useMemo(() => ({
    density,
    isSpreadsheetMode,
    is2K1Mode,
    isCompactMode,
    isLoading,
    getSectionDensityClass,
    getSpacingClass,
    getTextClass,
  }), [density, isSpreadsheetMode, is2K1Mode, isCompactMode, isLoading, getSectionDensityClass, getSpacingClass, getTextClass]);

  return (
    <UIDensityContext.Provider value={value}>
      {children}
    </UIDensityContext.Provider>
  );
}

export function useUIDensity() {
  return useContext(UIDensityContext);
}

/**
 * Hook for section-level density overrides
 * Allows individual sections to have different density than global setting
 */
export function useSectionDensity(sectionId: string, defaultOverride?: SectionDensity) {
  const { density, getSectionDensityClass, isCompactMode } = useUIDensity();
  
  // In the future, this could read from user preferences per section
  // For now, it just returns the helper function with the default
  const override: SectionDensityOverride | undefined = defaultOverride 
    ? { density: defaultOverride } 
    : undefined;
  
  return {
    sectionClass: getSectionDensityClass(override),
    isCompact: isCompactMode || defaultOverride === "compact",
    density,
  };
}
