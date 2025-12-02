import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  LayoutDashboard,
  Package,
  Users,
  FolderKanban,
  Truck,
  FileText,
  Receipt,
  Settings,
  ChevronRight,
  Briefcase,
  ShoppingCart,
  LogOut,
  Shield,
  Clock,
  UserCog,
  UserCheck,
} from "lucide-react";
const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Products",
    href: "/products",
    icon: Package,
  },
  {
    name: "Customers",
    href: "/customers",
    icon: Users,
  },
  {
    name: "Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    name: "Personnel",
    href: "/personnel",
    icon: UserCheck,
  },
  {
    name: "Vendors",
    href: "/vendors",
    icon: Truck,
  },
  {
    name: "Estimates",
    href: "/estimates",
    icon: FileText,
  },
  {
    name: "Job Orders",
    href: "/job-orders",
    icon: Briefcase,
  },
  {
    name: "Purchase Orders",
    href: "/purchase-orders",
    icon: ShoppingCart,
  },
  {
    name: "Invoices",
    href: "/invoices",
    icon: Receipt,
  },
  {
    name: "Time Tracking",
    href: "/time-tracking",
    icon: Clock,
  },
];
export function Sidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin, isManager } = useUserRole();
  return (
    <aside className="hidden lg:block fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-20 items-center justify-center px-6 border-b border-sidebar-border">
          <img
            src={logo}
            alt="Command X"
            className="h-10 w-full object-fill border-0 border-primary shadow-none"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {item.name}
                {isActive && (
                  <ChevronRight className="ml-auto h-4 w-4 text-primary" />
                )}
              </Link>
            );
          })}

          {(isAdmin || isManager) && (
            <Link
              to="/project-assignments"
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/project-assignments"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              <UserCog
                className={cn(
                  "h-5 w-5 transition-colors",
                  location.pathname === "/project-assignments"
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              Project Assignments
              {location.pathname === "/project-assignments" && (
                <ChevronRight className="ml-auto h-4 w-4 text-primary" />
              )}
            </Link>
          )}
        </nav>

        {/* Settings & Profile */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          {user && (
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-muted-foreground truncate">
                {user.email}
              </span>
              <ThemeToggle />
            </div>
          )}
          {isAdmin && (
            <Link
              to="/user-management"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/user-management"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              <Shield className="h-5 w-5" />
              User Management
            </Link>
          )}
          <Link
            to="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all duration-200"
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all duration-200"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </div>
    </aside>
  );
}
