import { ReactNode } from "react";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { cn } from "@/lib/utils";
import { PageHeaderActionsProvider, usePageHeaderActions } from "@/contexts/PageHeaderActionsContext";
import { useUIDensity } from "@/contexts/UIDensityContext";

interface PageLayoutProps {
  children: ReactNode;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}

/**
 * PageLayout renders the page content with header, title, and actions.
 * It expects to be wrapped by SidebarLayout which provides the SidebarProvider context.
 */
function PageLayoutContent({
  children,
  title,
  description,
  actions,
}: PageLayoutProps) {
  const { swipeRef, isMobile } = useSwipeNavigation();
  const { rightActions } = usePageHeaderActions();
  const { isSpreadsheetMode, is2K1Mode, isCompactMode } = useUIDensity();

  // 2K1: ~30% tighter spacing than normal, but not as extreme as spreadsheet
  // Spreadsheet: Ultra compact (existing behavior)
  // Normal: Default spacing
  const getPadding = () => {
    if (isSpreadsheetMode) return "p-2 lg:p-3";
    if (is2K1Mode) return "p-3 lg:p-4";
    return "p-4 lg:p-6";
  };

  const getHeaderMargin = () => {
    if (isSpreadsheetMode) return "mb-2";
    if (is2K1Mode) return "mb-3";
    return "mb-4 sm:mb-6";
  };

  const getTitleSize = () => {
    if (isSpreadsheetMode) return "text-base sm:text-lg";
    if (is2K1Mode) return "text-base sm:text-xl";
    return "text-lg sm:text-2xl";
  };

  return (
    <main
      className={cn(
        "flex-1 min-h-0 overflow-x-hidden relative z-[1]",
        getPadding(),
        isMobile && "pb-24"
      )}
    >
        <div ref={swipeRef} className="max-w-[1600px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] 5xl:max-w-[3000px] mx-auto w-full">
          <header className={cn(
            "relative z-[2] flex flex-row items-center justify-between gap-2",
            getHeaderMargin()
          )}>
            <div className="min-w-0 flex-1">
              <h1 className={cn(
                "font-heading font-bold text-foreground truncate",
                getTitleSize()
              )}>
                {title}
              </h1>
              {description && !isCompactMode && (
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {description}
                </p>
              )}
            </div>
            {(actions || rightActions) && (
              <div className={cn(
                "flex items-center shrink-0",
                is2K1Mode ? "gap-1.5" : "gap-2"
              )}>
                {actions}
                {rightActions}
              </div>
            )}
          </header>

          {/* Page Content */}
          <div className={isCompactMode ? "" : "animate-fade-in"}>{children}</div>
        </div>
      </main>
  );
}

/**
 * PageLayout renders the page content with header, title, and actions.
 * It expects to be wrapped by SidebarLayout which provides the SidebarProvider context.
 */
export function PageLayout(props: PageLayoutProps) {
  return (
    <PageHeaderActionsProvider>
      <PageLayoutContent {...props} />
    </PageHeaderActionsProvider>
  );
}
