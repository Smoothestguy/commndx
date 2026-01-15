import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MobileActionBar, ActionButton } from "./MobileActionBar";

interface DetailPageLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  backPath: string;
  desktopActions?: ReactNode;
  mobileActions?: {
    primary: ActionButton[];
    secondary?: ActionButton[];
  };
}

/**
 * DetailPageLayout renders detail page content with back navigation and actions.
 * It expects to be wrapped by SidebarLayout which provides the SidebarProvider context.
 */
export function DetailPageLayout({
  children,
  title,
  subtitle,
  backPath,
  desktopActions,
  mobileActions,
}: DetailPageLayoutProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 glass border-b border-border/50">
        <div className="flex h-14 items-center px-4 gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(backPath)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-base font-bold truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden md:flex h-14 sticky top-0 z-50 items-center gap-2 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <SidebarTrigger className="h-8 w-8" />
        <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </header>

      <main className={cn(isMobile && mobileActions && "pb-32")}>
        <div className="px-4 sm:px-6 lg:px-8 3xl:px-12 4xl:px-16 5xl:px-24 py-4 sm:py-6">
          <div className="max-w-[1600px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] 5xl:max-w-[3000px] mx-auto">
            {/* Desktop Title Section */}
            {!isMobile && (
              <header className="mb-6 sm:mb-8 flex items-center justify-between gap-4">
                <div>
                  <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="mt-1 text-sm sm:text-base text-muted-foreground">
                      {subtitle}
                    </p>
                  )}
                </div>
                {desktopActions && (
                  <div className="flex items-center gap-3">{desktopActions}</div>
                )}
              </header>
            )}

            {/* Content */}
            <div className="animate-fade-in">{children}</div>
          </div>
        </div>
      </main>

      {/* Mobile Action Bar */}
      {isMobile && mobileActions && (
        <MobileActionBar
          primaryActions={mobileActions.primary}
          secondaryActions={mobileActions.secondary}
        />
      )}
    </>
  );
}
