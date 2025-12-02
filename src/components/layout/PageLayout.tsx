import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

interface PageLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageLayout({ children, title, description, actions }: PageLayoutProps) {
  const { swipeRef } = useSwipeNavigation();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Simplified Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 h-14 border-b border-border glass safe-area-top">
        <div className="flex h-full items-center px-4">
          <img 
            src={logo} 
            alt="Command X" 
            className="h-8 sm:h-9 md:h-10 w-auto max-w-[180px] sm:max-w-[200px] md:max-w-[220px] object-contain" 
          />
        </div>
      </header>

      <main className={cn("lg:pl-64", isMobile && "pb-24")}>
        <div ref={swipeRef} className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Header */}
          <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground animate-fade-in">
                {title}
              </h1>
              {description && (
                <p className="mt-1 text-sm sm:text-base text-muted-foreground animate-fade-in">
                  {description}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-3 animate-fade-in">
                {actions}
              </div>
            )}
          </header>

          {/* Content */}
          <div className="animate-slide-up">{children}</div>
        </div>
      </main>
    </div>
  );
}
