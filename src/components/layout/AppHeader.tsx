import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MobileNav } from "./MobileNav";
import { ThemeToggleSimple } from "@/components/ThemeToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, Settings, LogOut } from "lucide-react";

export function AppHeader() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const userInitials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "U";

  return (
    <header className="h-14 bg-header/95 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-4 border-b border-border/30">
      {/* Left side: Sidebar Toggle + Mobile menu */}
      <div className="flex items-center gap-2">
        {/* Desktop sidebar toggle */}
        <SidebarTrigger className="hidden md:flex h-8 w-8" />

        {/* Mobile menu trigger */}
        <div className="md:hidden">
          <MobileNav />
        </div>
      </div>

      {/* Right side: Theme toggle + User menu */}
      <div className="flex items-center gap-3">
        <ThemeToggleSimple />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity outline-none">
            <Avatar className="h-8 w-8 ring-2 ring-primary/20 transition-all duration-300 hover:ring-primary/40">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline text-header-foreground text-sm max-w-[150px] truncate">
              {user?.email}
            </span>
            <ChevronDown className="h-4 w-4 text-sidebar-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 backdrop-blur-xl bg-popover/95 border-border/50">
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