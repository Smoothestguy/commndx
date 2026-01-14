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
  const { isSpreadsheetMode } = useUIDensity();

  return (
    <main
      className={cn(
        "flex-1 min-h-0 overflow-x-hidden relative z-[1]",
        isSpreadsheetMode ? "p-2 lg:p-3" : "p-4 lg:p-6",
        isMobile && "pb-24"
      )}
    >
        <div ref={swipeRef} className="max-w-[1600px] mx-auto w-full">
          <header className={cn(
            "relative z-[2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2",
            isSpreadsheetMode ? "mb-2" : "mb-6 gap-4"
          )}>
            <div>
              <h1 className={cn(
                "font-heading font-bold text-foreground",
                isSpreadsheetMode ? "text-base sm:text-lg" : "text-xl sm:text-2xl"
              )}>
                {title}
              </h1>
              {description && !isSpreadsheetMode && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          {(actions || rightActions) && (
              <div className={cn(
                "flex flex-col w-full sm:flex-row sm:items-center sm:w-auto sm:justify-end",
                isSpreadsheetMode ? "gap-1 sm:gap-2" : "gap-2 sm:gap-3"
              )}>
                {actions && <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto min-w-0">{actions}</div>}
                {rightActions && <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto min-w-0 justify-end">{rightActions}</div>}
              </div>
            )}
          </header>

          {/* Page Content */}
          <div className={isSpreadsheetMode ? "" : "animate-fade-in"}>{children}</div>
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
