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
  /** Optional section-level density override */
  sectionDensity?: "compact" | "default" | "relaxed";
}

/**
 * PageLayout renders the page content with header, title, and actions.
 * It expects to be wrapped by SidebarLayout which provides the SidebarProvider context.
 * 
 * Uses CSS density tokens for automatic spacing adjustment based on global theme.
 */
function PageLayoutContent({
  children,
  title,
  description,
  actions,
  sectionDensity,
}: PageLayoutProps) {
  const { swipeRef, isMobile } = useSwipeNavigation();
  const { rightActions } = usePageHeaderActions();
  const { isCompactMode, getSectionDensityClass } = useUIDensity();

  // Get section-level density class if override specified
  const sectionClass = getSectionDensityClass(sectionDensity ? { density: sectionDensity } : undefined);

  return (
    <main
      className={cn(
        "flex-1 min-h-0 overflow-x-hidden relative z-[1]",
        // Use density tokens for padding
        "p-[var(--density-spacing-lg)] lg:p-[var(--density-spacing-xl)]",
        isMobile && "pb-24",
        sectionClass
      )}
    >
      <div ref={swipeRef} className="max-w-[1600px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] 5xl:max-w-[3000px] mx-auto w-full">
        <header className={cn(
          "relative z-[2] flex flex-row items-center justify-between",
          // Use density tokens for margins
          "gap-[var(--density-spacing-xs)] mb-[var(--density-spacing-lg)]"
        )}>
          <div className="min-w-0 flex-1">
            <h1 className={cn(
              "font-heading font-bold text-foreground truncate",
              // Use density tokens for font size
              "text-[length:var(--density-font-xl)] sm:text-[length:var(--density-font-2xl)]"
            )}>
              {title}
            </h1>
            {description && !isCompactMode && (
              <p className="text-[length:var(--density-font-xs)] sm:text-[length:var(--density-font-sm)] text-muted-foreground truncate">
                {description}
              </p>
            )}
          </div>
          {(actions || rightActions) && (
            <div className={cn(
              "flex items-center shrink-0",
              "gap-[var(--density-spacing-xs)]"
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
