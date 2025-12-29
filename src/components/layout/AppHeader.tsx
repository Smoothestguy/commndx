import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAIAssistant } from "@/contexts/AIAssistantContext";
import { MobileNav } from "./MobileNav";
import { ThemeToggleSimple } from "@/components/ThemeToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, Settings, LogOut, MessageCircle } from "lucide-react";
import { AdminNotificationBell } from "@/components/notifications/AdminNotificationBell";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { SessionTimer } from "@/components/session/SessionTimer";

export function AppHeader() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isOpen, toggleOpen, messages } = useAIAssistant();
  const { isAdmin, isManager } = useUserRole();
  const { data: personnel } = useCurrentPersonnel();

  // Use personnel photo if available, otherwise use email initials
  const userInitials = personnel
    ? `${personnel.first_name?.[0] || ""}${personnel.last_name?.[0] || ""}`.toUpperCase()
    : user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "U";
  
  const userPhotoUrl = personnel?.photo_url;

  const showNotificationBell = isAdmin || isManager;

  return (
    <header className="h-14 bg-header sticky top-0 z-50 flex items-center justify-between px-2 sm:px-4 border-b border-sidebar-border max-w-full overflow-x-hidden">
      {/* Left side: Sidebar Toggle + Mobile menu */}
      <div className="flex items-center gap-2">
        {/* Desktop sidebar toggle */}
        <SidebarTrigger className="hidden md:flex h-8 w-8" />

        {/* Mobile menu trigger */}
        <div className="md:hidden">
          <MobileNav />
        </div>
      </div>

      {/* Right side: AI Assistant + Notifications + Theme toggle + User menu */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleOpen}
          className="relative h-8 w-8 text-header-foreground hover:bg-sidebar-accent"
          title="AI Assistant"
        >
          <MessageCircle className="h-5 w-5" />
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

        <ThemeToggleSimple />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 hover:opacity-80 transition-opacity outline-none">
            <Avatar className="h-8 w-8 bg-sidebar-accent">
              <AvatarImage src={userPhotoUrl || undefined} alt="User avatar" />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="h-4 w-4 text-sidebar-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-sm text-muted-foreground truncate">
              {user?.email}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
