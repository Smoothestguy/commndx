import { useAuth } from "@/contexts/AuthContext";
import { useAIAssistant } from "@/contexts/AIAssistantContext";
import { MobileNav } from "./MobileNav";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { AdminNotificationBell } from "@/components/notifications/AdminNotificationBell";
import { useUserRole } from "@/hooks/useUserRole";
import { SessionTimer } from "@/components/session/SessionTimer";

export function AppHeader() {
  const { signOut } = useAuth();
  const { isOpen, toggleOpen, messages } = useAIAssistant();
  const { isAdmin, isManager } = useUserRole();

  const showNotificationBell = isAdmin || isManager;

  return (
    <header className="h-14 bg-header sticky top-0 z-50 flex items-center justify-between gap-2 px-2 sm:px-4 border-b border-sidebar-border max-w-full overflow-x-hidden">
      {/* Mobile menu trigger - left side */}
      <div className="md:hidden">
        <MobileNav />
      </div>
      
      {/* Desktop sidebar toggle - left side with auto margin */}
      <SidebarTrigger className="hidden md:flex h-8 w-8 mr-auto text-header-foreground hover:bg-sidebar-accent" />

      {/* Right side icons grouped together */}
      <div className="flex items-center gap-1 sm:gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleOpen}
          className="relative h-7 w-7 sm:h-8 sm:w-8 text-header-foreground hover:bg-sidebar-accent"
          title="AI Assistant"
        >
          <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
          {messages.length === 0 && !isOpen && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>
          )}
        </Button>

        {/* Session Timer - visible for users with user management access */}
        <SessionTimer />

        {showNotificationBell && <AdminNotificationBell />}
      </div>
    </header>
  );
}