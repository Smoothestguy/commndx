import { createContext, useContext, useState, ReactNode, useCallback } from "react";

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

  return (
    <PageHeaderActionsContext.Provider value={{ rightActions, setRightActions }}>
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
