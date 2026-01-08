import { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import { BackgroundMediaLayer } from "./BackgroundMediaLayer";
import { DashboardDraftProvider } from "@/contexts/DashboardDraftContext";
import { useBackgroundMedia } from "./useBackgroundMedia";
import { cn } from "@/lib/utils";

interface SidebarLayoutProps {
  children?: ReactNode;
}

/**
 * SidebarLayout wraps the application with a collapsible sidebar.
 * SidebarProvider is now provided at a higher level in App.tsx to ensure
 * context is always available for AppSidebar and other consumers.
 * 
 * Use this as a layout route in React Router or wrap page content directly.
 */
export function SidebarLayout({ children }: SidebarLayoutProps) {
  const { shouldShowBackground } = useBackgroundMedia();

  return (
    <DashboardDraftProvider>
      <div className="min-h-screen flex w-full bg-background overflow-x-hidden max-w-full">
        {/* Global Background Media Layer */}
        <BackgroundMediaLayer />
        <AppSidebar />
        <SidebarInset
          className={cn(
            "flex flex-col flex-1 relative z-[1]",
            shouldShowBackground && "bg-transparent"
          )}
        >
          {children ?? <Outlet />}
        </SidebarInset>
      </div>
    </DashboardDraftProvider>
  );
}


