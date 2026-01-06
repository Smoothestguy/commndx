import { createContext, useContext, useState, ReactNode } from "react";
import { DashboardTheme } from "@/components/dashboard/widgets/types";

interface DashboardDraftContextValue {
  draftTheme: DashboardTheme | null;
  isEditMode: boolean;
  setDraftTheme: (theme: DashboardTheme | null) => void;
  setIsEditMode: (isEdit: boolean) => void;
}

const DashboardDraftContext = createContext<DashboardDraftContextValue | null>(null);

interface DashboardDraftProviderProps {
  children: ReactNode;
  draftTheme?: DashboardTheme | null;
  isEditMode?: boolean;
}

export function DashboardDraftProvider({
  children,
  draftTheme: externalDraftTheme,
  isEditMode: externalIsEditMode,
}: DashboardDraftProviderProps) {
  const [internalDraftTheme, setInternalDraftTheme] = useState<DashboardTheme | null>(null);
  const [internalIsEditMode, setInternalIsEditMode] = useState(false);

  // Use external values if provided, otherwise use internal state
  const draftTheme = externalDraftTheme !== undefined ? externalDraftTheme : internalDraftTheme;
  const isEditMode = externalIsEditMode !== undefined ? externalIsEditMode : internalIsEditMode;

  return (
    <DashboardDraftContext.Provider
      value={{
        draftTheme,
        isEditMode,
        setDraftTheme: setInternalDraftTheme,
        setIsEditMode: setInternalIsEditMode,
      }}
    >
      {children}
    </DashboardDraftContext.Provider>
  );
}

export function useDashboardDraft() {
  const context = useContext(DashboardDraftContext);
  return context;
}
