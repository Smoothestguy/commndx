import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/logo.png";
import {
  LayoutDashboard,
  Package,
  Users,
  FolderKanban,
  Truck,
  FileText,
  Receipt,
  Settings,
  Briefcase,
  ShoppingCart,
  LogOut,
  Shield,
  Menu,
  Clock,
  UserCog,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Vendors", href: "/vendors", icon: Truck },
  { name: "Products", href: "/products", icon: Package },
  { name: "Estimates", href: "/estimates", icon: FileText },
  { name: "Job Orders", href: "/job-orders", icon: Briefcase },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { name: "Invoices", href: "/invoices", icon: Receipt },
];

const staffingNavigation = [
  { name: "Time Tracking", href: "/time-tracking", icon: Clock },
  { name: "Project Assignments", href: "/project-assignments", icon: UserCog, requiresManager: true },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isAdmin, isManager } = useUserRole();

  const handleNavigation = (href: string) => {
    navigate(href);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-11 w-11 hover:bg-sidebar-accent"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-sidebar-border">
        <div className="flex h-full flex-col">
          {/* Logo Header */}
          <div className="flex h-20 items-center justify-center px-6 border-b border-sidebar-border">
            <img src={logo} alt="Command X" className="h-10 w-full max-w-[200px] object-contain" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  className={cn(
                    "w-full group flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-all duration-200 min-h-[48px]",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-6 w-6 transition-colors flex-shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {item.name}
                </button>
              );
            })}

            {/* Staffing Section */}
            <div className="mt-4 pt-4 border-t border-sidebar-border">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Staffing
              </div>
              {staffingNavigation.map((item) => {
                if (item.requiresManager && !isAdmin && !isManager) return null;
                const isActive = location.pathname === item.href;
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      "w-full group flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-all duration-200 min-h-[48px]",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-6 w-6 transition-colors flex-shrink-0",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    {item.name}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Settings & Profile */}
          <div className="border-t border-sidebar-border p-3 space-y-1">
            {user && (
              <div className="px-4 py-2 text-xs text-muted-foreground truncate">
                {user.email}
              </div>
            )}
            {isAdmin && (
              <button
                onClick={() => handleNavigation("/user-management")}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-all duration-200 min-h-[48px]",
                  location.pathname === "/user-management"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
              >
                <Shield className="h-6 w-6 flex-shrink-0" />
                User Management
              </button>
            )}
            <button
              onClick={() => handleNavigation("/settings")}
              className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all duration-200 min-h-[48px]"
            >
              <Settings className="h-6 w-6 flex-shrink-0" />
              Settings
            </button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-4 py-3 text-base font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all duration-200 min-h-[48px]"
              onClick={signOut}
            >
              <LogOut className="h-6 w-6 flex-shrink-0" />
              Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
