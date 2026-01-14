import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { Menu, Search, Plus, User, Bell, LogOut } from "lucide-react";
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
import logo from "@/assets/logo.png";

interface TopNavBarProps {
  onMobileMenuToggle?: () => void;
}

export function TopNavBar({ onMobileMenuToggle }: TopNavBarProps) {
  const { user, signOut } = useAuth();
  const { isAdmin, isManager } = useUserRole();

  return (
    <header className="sticky top-0 z-50 h-14 bg-header-background border-b border-header-background/20">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left Section: Mobile Menu + Logo */}
        <div className="flex items-center gap-4">
          {/* Mobile hamburger menu */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-header-foreground hover:bg-white/10"
            onClick={onMobileMenuToggle}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img
              src={logo}
              alt="Fairfield"
              className="h-8 w-auto object-contain"
            />
          </Link>

          {/* Mega Menu Navigation - Desktop only */}
          <nav className="hidden lg:flex items-center gap-1 ml-8">
            <MegaMenu />
          </nav>
        </div>

        {/* Right Section: Search, Quick Create, Notifications, User */}
        <div className="flex items-center gap-2">
          {/* Global Search */}
          <GlobalSearch />

          {/* Quick Create Button */}
          <QuickCreateMenu />

          {/* Notifications */}
          {(isAdmin || isManager) && <AdminNotificationBell />}

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-header-foreground hover:bg-white/10"
              >
                <User className="h-5 w-5" />
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
