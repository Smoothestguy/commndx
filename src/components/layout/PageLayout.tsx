import { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { cn } from "@/lib/utils";

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
export function PageLayout({
  children,
  title,
  description,
  actions,
}: PageLayoutProps) {
  const { swipeRef, isMobile } = useSwipeNavigation();

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
            {actions && (
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">{actions}</div>
            )}
          </header>

          {/* Page Content */}
          <div className="animate-fade-in">{children}</div>
        </div>
      </main>
    </>
  );
}
