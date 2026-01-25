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
  const { isSpreadsheetMode, is2K1Mode, isCompactMode } = useUIDensity();

  // 2K1: ~30% tighter spacing than normal
  // Spreadsheet: Ultra compact (existing behavior)
  const getPadding = () => {
    if (isSpreadsheetMode) return "p-2 lg:p-3";
    if (is2K1Mode) return "p-3 lg:p-4";
    return "p-4 lg:p-6";
  };

  const getHeaderMargin = () => {
    if (isSpreadsheetMode) return "mb-2";
    if (is2K1Mode) return "mb-3 gap-2";
    return "mb-6 gap-4";
  };

  const getTitleSize = () => {
    if (isSpreadsheetMode) return "text-base sm:text-lg";
    if (is2K1Mode) return "text-base sm:text-xl";
    return "text-xl sm:text-2xl";
  };

  return (
    <div
      className={cn(
        "flex-1 overflow-x-hidden relative z-[1]",
        getPadding()
      )}
    >
      <div className="max-w-[1600px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] 5xl:max-w-[3000px] mx-auto w-full">
        {/* Page Header */}
        <header
          className={cn(
            "relative z-[2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2",
            getHeaderMargin()
          )}
        >
          <div>
            <h1
              className={cn(
                "font-heading font-bold text-foreground",
                getTitleSize()
              )}
            >
              {title}
            </h1>
            {description && !isCompactMode && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {(actions || rightActions) && (
            <div
              className={cn(
                "flex flex-col w-full sm:flex-row sm:items-center sm:w-auto sm:justify-end",
                is2K1Mode ? "gap-1 sm:gap-1.5" : isSpreadsheetMode ? "gap-1 sm:gap-2" : "gap-2 sm:gap-3"
              )}
            >
              {actions && (
                <div className={cn(
                  "flex items-center overflow-x-auto min-w-0",
                  is2K1Mode ? "gap-1 sm:gap-1.5" : "gap-1 sm:gap-2"
                )}>
                  {actions}
                </div>
              )}
              {rightActions && (
                <div className={cn(
                  "flex items-center overflow-x-auto min-w-0 justify-end",
                  is2K1Mode ? "gap-1 sm:gap-1.5" : "gap-1 sm:gap-2"
                )}>
                  {rightActions}
                </div>
              )}
            </div>
          )}
        </header>

        {/* Page Content */}
        <div className={isCompactMode ? "" : "animate-fade-in"}>{children}</div>
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
