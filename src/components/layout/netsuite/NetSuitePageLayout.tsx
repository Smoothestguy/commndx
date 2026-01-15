import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PageHeaderActionsProvider, usePageHeaderActions } from "@/contexts/PageHeaderActionsContext";
import { useUIDensity } from "@/contexts/UIDensityContext";

interface NetSuitePageLayoutProps {
  children: ReactNode;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}

/**
 * NetSuitePageLayout renders page content within the 3-panel layout.
 * It provides a consistent header with title and actions.
 */
function NetSuitePageLayoutContent({
  children,
  title,
  description,
  actions,
}: NetSuitePageLayoutProps) {
  const { rightActions } = usePageHeaderActions();
  const { isSpreadsheetMode } = useUIDensity();

  return (
    <div
      className={cn(
        "flex-1 overflow-x-hidden relative z-[1]",
        isSpreadsheetMode ? "p-2 lg:p-3" : "p-4 lg:p-6"
      )}
    >
      <div className="max-w-[1600px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] 5xl:max-w-[3000px] mx-auto w-full">
        {/* Page Header */}
        <header
          className={cn(
            "relative z-[2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2",
            isSpreadsheetMode ? "mb-2" : "mb-6 gap-4"
          )}
        >
          <div>
            <h1
              className={cn(
                "font-heading font-bold text-foreground",
                isSpreadsheetMode ? "text-base sm:text-lg" : "text-xl sm:text-2xl"
              )}
            >
              {title}
            </h1>
            {description && !isSpreadsheetMode && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {(actions || rightActions) && (
            <div
              className={cn(
                "flex flex-col w-full sm:flex-row sm:items-center sm:w-auto sm:justify-end",
                isSpreadsheetMode ? "gap-1 sm:gap-2" : "gap-2 sm:gap-3"
              )}
            >
              {actions && (
                <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto min-w-0">
                  {actions}
                </div>
              )}
              {rightActions && (
                <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto min-w-0 justify-end">
                  {rightActions}
                </div>
              )}
            </div>
          )}
        </header>

        {/* Page Content */}
        <div className={isSpreadsheetMode ? "" : "animate-fade-in"}>{children}</div>
      </div>
    </div>
  );
}

export function NetSuitePageLayout(props: NetSuitePageLayoutProps) {
  return (
    <PageHeaderActionsProvider>
      <NetSuitePageLayoutContent {...props} />
    </PageHeaderActionsProvider>
  );
}
