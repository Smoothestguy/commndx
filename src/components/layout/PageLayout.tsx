import { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const { swipeRef } = useSwipeNavigation();
  const isMobile = useIsMobile();

  return (
    <>
      {/* Fixed Header */}
      <AppHeader />

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 min-h-[calc(100vh-3.5rem)] p-4 lg:p-6",
          isMobile && "pb-24"
        )}
      >
        <div ref={swipeRef} className="max-w-[1600px] mx-auto">
          {/* Page Header */}
          <header className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
              <div className="flex items-center gap-3 flex-wrap">{actions}</div>
            )}
          </header>

          {/* Page Content */}
          <div className="animate-fade-in">{children}</div>
        </div>
      </main>
    </>
  );
}
