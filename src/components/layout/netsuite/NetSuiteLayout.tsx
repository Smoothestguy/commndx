import { ReactNode, useState } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TopNavBar } from "./TopNavBar";
import { RightPanel } from "./RightPanel";
import { MobileNavDrawer } from "../MobileNavDrawer";
import { BottomNav } from "../BottomNav";
import { BackgroundMediaLayer } from "../BackgroundMediaLayer";
import { AppSidebar } from "../AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardDraftProvider } from "@/contexts/DashboardDraftContext";
import { useBackgroundMedia } from "../useBackgroundMedia";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { MessageBannerProvider } from "@/contexts/MessageBannerContext";
import { MessageBanner } from "@/components/messaging/MessageBanner";
import { useIncomingMessageListener } from "@/hooks/useIncomingMessageListener";

function IncomingMessageListenerMount() {
  useIncomingMessageListener();
  return null;
}

interface NetSuiteLayoutProps {
  children?: ReactNode;
}

export function NetSuiteLayout({ children }: NetSuiteLayoutProps) {
  const { shouldShowBackground } = useBackgroundMedia();
  const { activeTheme } = useDashboardConfig();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true);
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen>
      <DashboardDraftProvider>
        <MessageBannerProvider>
          <IncomingMessageListenerMount />
          <MessageBanner />
          <div className="min-h-screen flex flex-col w-full bg-background overflow-x-hidden max-w-full">
            <BackgroundMediaLayer />

            <TopNavBar onMobileMenuToggle={() => setMobileMenuOpen(true)} />

            <MobileNavDrawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />

            <div className="flex flex-1 relative z-[1] w-full">
              {!isMobile && <AppSidebar />}

              <main
                className={cn(
                  "flex-1 flex flex-col overflow-x-hidden min-w-0",
                  isMobile ? "min-h-[calc(100vh-7.5rem)]" : "min-h-[calc(100vh-3.5rem)]",
                  shouldShowBackground && "bg-transparent",
                )}
              >
                {children ?? <Outlet />}
              </main>

              {!isMobile && (
                <RightPanel
                  collapsed={rightPanelCollapsed}
                  onToggleCollapse={() => setRightPanelCollapsed(!rightPanelCollapsed)}
                  backgroundColor={activeTheme?.rightSidebarBackground}
                  textColor={activeTheme?.rightSidebarTextColor}
                />
              )}
            </div>

            {isMobile && <BottomNav onMoreClick={() => setMobileMenuOpen(true)} />}
          </div>
        </MessageBannerProvider>
      </DashboardDraftProvider>
    </SidebarProvider>
  );
}

