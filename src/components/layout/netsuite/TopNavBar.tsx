import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { Menu, User, LogOut, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MegaMenu } from "./MegaMenu";
import { QuickCreateMenu } from "./QuickCreateMenu";
import { GlobalSearch } from "./GlobalSearch";
import { AdminNotificationBell } from "@/components/notifications/AdminNotificationBell";
import { SessionTimer } from "@/components/session/SessionTimer";
import { useAIAssistant } from "@/contexts/AIAssistantContext";
import logo from "@/assets/logo.png";

interface TopNavBarProps {
  onMobileMenuToggle?: () => void;
}

export function TopNavBar({ onMobileMenuToggle }: TopNavBarProps) {
  const { user, signOut } = useAuth();
  const { isAdmin, isManager } = useUserRole();
  const { toggleOpen, messages } = useAIAssistant();
  
  // Check for unread messages (last message is from assistant)
  const hasUnread = messages.length > 0 && messages[messages.length - 1].role === "assistant";

  return (
    <header className="sticky top-0 z-50 h-12 bg-header-background border-b border-header-background/20">
      <div className="flex items-center justify-between h-full px-3">
        {/* Left Section: Mobile Menu + Logo + Navigation */}
        <div className="flex items-center gap-2">
          {/* Mobile hamburger menu */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-header-foreground hover:bg-white/10 h-8 w-8"
            onClick={onMobileMenuToggle}
          >
            <Menu className="h-4 w-4" />
          </Button>

          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img
              src={logo}
              alt="Fairfield"
              className="h-6 w-auto object-contain"
            />
          </Link>

          {/* Mega Menu Navigation - Desktop only */}
          <nav className="hidden lg:flex items-center ml-4">
            <MegaMenu />
          </nav>
        </div>

        {/* Right Section: Session + Actions + User */}
        <div className="flex items-center gap-1">
          {/* AI Assistant Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleOpen}
            className="relative text-header-foreground hover:bg-white/10 h-8 w-8"
          >
            <MessageCircle className="h-4 w-4" />
            {hasUnread && (
              <span className="absolute top-1 right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </Button>

          {/* Divider */}
          <div className="h-5 w-px bg-white/20 mx-1 hidden sm:block" />

          {/* Session Timer */}
          <div className="hidden sm:block">
            <SessionTimer />
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-white/20 mx-1 hidden md:block" />

          {/* Global Search */}
          <GlobalSearch />

          {/* Quick Create Button */}
          <QuickCreateMenu />

          {/* Divider */}
          <div className="h-5 w-px bg-white/20 mx-1" />

          {/* Notifications */}
          {(isAdmin || isManager) && <AdminNotificationBell />}

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-header-foreground hover:bg-white/10 h-8 w-8"
              >
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? "Administrator" : isManager ? "Manager" : "User"}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/activity-history">Activity History</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
