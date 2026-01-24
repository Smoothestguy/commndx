import { ReactNode, useState } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TopNavBar } from "./TopNavBar";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { MobileDrawer } from "./MobileDrawer";
import { BackgroundMediaLayer } from "../BackgroundMediaLayer";
import { DashboardDraftProvider } from "@/contexts/DashboardDraftContext";
import { useBackgroundMedia } from "../useBackgroundMedia";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";

interface NetSuiteLayoutProps {
  children?: ReactNode;
}

/**
 * NetSuiteLayout provides a 3-panel ERP-style layout:
 * - Top navigation bar with mega-menu
 * - Left panel for reminders, tasks, and recent records
 * - Center content area for main page content
 * - Right panel for KPIs and metrics
 */
export function NetSuiteLayout({ children }: NetSuiteLayoutProps) {
  const { shouldShowBackground } = useBackgroundMedia();
  const { activeTheme } = useDashboardConfig();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(true);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true);
  const isMobile = useIsMobile();

  return (
    <DashboardDraftProvider>
      <div className="min-h-screen flex flex-col w-full bg-background overflow-x-hidden max-w-full">
        {/* Global Background Media Layer */}
        <BackgroundMediaLayer />

        {/* Top Navigation Bar */}
        <TopNavBar onMobileMenuToggle={() => setMobileMenuOpen(true)} />

        {/* Mobile Drawer */}
        <MobileDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

        {/* Main 3-Panel Content Area */}
        <div className="flex flex-1 relative z-[1]">
          {/* Left Panel - Hidden on mobile */}
          {!isMobile && (
            <LeftPanel 
              collapsed={leftPanelCollapsed}
              onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
              backgroundColor={activeTheme?.leftSidebarBackground}
              textColor={activeTheme?.leftSidebarTextColor}
            />
          )}

          {/* Center Content */}
          <main
            className={cn(
              "flex-1 flex flex-col overflow-x-hidden",
              // Account for top nav (3.5rem) and bottom nav on mobile (4rem)
              isMobile ? "min-h-[calc(100vh-7.5rem)]" : "min-h-[calc(100vh-3.5rem)]",
              shouldShowBackground && "bg-transparent"
            )}
          >
            {children ?? <Outlet />}
          </main>

          {/* Right Panel - Hidden on mobile */}
          {!isMobile && (
            <RightPanel
              collapsed={rightPanelCollapsed}
              onToggleCollapse={() => setRightPanelCollapsed(!rightPanelCollapsed)}
              backgroundColor={activeTheme?.rightSidebarBackground}
              textColor={activeTheme?.rightSidebarTextColor}
            />
          )}
        </div>
      </div>
    </DashboardDraftProvider>
  );
}
