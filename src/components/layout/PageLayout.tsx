import { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { cn } from "@/lib/utils";
import { PageHeaderActionsProvider, usePageHeaderActions } from "@/contexts/PageHeaderActionsContext";

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

  return (
    <>
      {/* Fixed Header */}
      <AppHeader />

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 min-h-[calc(100vh-3.5rem)] p-4 lg:p-6 overflow-x-hidden relative z-[1]",
          isMobile && "pb-24"
        )}
      >
        <div ref={swipeRef} className="max-w-[1600px] mx-auto w-full">
          <header className="relative z-[2] mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
                {title}
              </h1>
              {description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          {(actions || rightActions) && (
              <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:w-auto sm:justify-end sm:gap-3">
                {actions && <div className="flex items-center gap-2 overflow-x-auto min-w-0">{actions}</div>}
                {rightActions && <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto min-w-0 justify-end">{rightActions}</div>}
              </div>
            )}
          </header>

          {/* Page Content */}
          <div className="animate-fade-in">{children}</div>
        </div>
      </main>
    </>
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
