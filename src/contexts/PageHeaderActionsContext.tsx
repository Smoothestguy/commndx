import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from "react";

interface PageHeaderActionsContextType {
  rightActions: ReactNode | null;
  setRightActions: (actions: ReactNode | null) => void;
}

const PageHeaderActionsContext = createContext<PageHeaderActionsContextType | null>(null);

export function PageHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [rightActions, setRightActionsState] = useState<ReactNode | null>(null);

  const setRightActions = useCallback((actions: ReactNode | null) => {
    setRightActionsState(actions);
  }, []);

  const value = useMemo(
    () => ({ rightActions, setRightActions }),
    [rightActions, setRightActions]
  );

  return (
    <PageHeaderActionsContext.Provider value={value}>
      {children}
    </PageHeaderActionsContext.Provider>
  );
}

export function usePageHeaderActions() {
  const context = useContext(PageHeaderActionsContext);
  if (!context) {
    throw new Error("usePageHeaderActions must be used within a PageHeaderActionsProvider");
  }
  return context;
}
