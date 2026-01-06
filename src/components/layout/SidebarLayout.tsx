import { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { BackgroundMediaLayer } from "./BackgroundMediaLayer";
import { DashboardDraftProvider } from "@/contexts/DashboardDraftContext";
import { useBackgroundMedia } from "./useBackgroundMedia";
import { cn } from "@/lib/utils";

interface SidebarLayoutProps {
  children?: ReactNode;
}

function SidebarLayoutContent({ children }: SidebarLayoutProps) {
  const { shouldShowBackground } = useBackgroundMedia();

  return (
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
  );
}

/**
 * SidebarLayout wraps the application with a collapsible sidebar.
 * It provides the SidebarProvider context at a high level so sidebar state
 * persists across page navigation.
 * 
 * Use this as a layout route in React Router or wrap page content directly.
 */
export function SidebarLayout({ children }: SidebarLayoutProps) {
  return (
    <DashboardDraftProvider>
      <SidebarProvider>
        <SidebarLayoutContent>{children}</SidebarLayoutContent>
      </SidebarProvider>
    </DashboardDraftProvider>
  );
}


