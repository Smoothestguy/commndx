import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ChevronDown,
  Briefcase,
  ShoppingCart,
  LogOut,
  Shield,
  Clock,
  UserCog,
  ClipboardCheck,
  IdCard,
  Link2,
  Send,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Products", href: "/products", icon: Package },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Personnel", href: "/personnel", icon: Users },
  { name: "Estimates", href: "/estimates", icon: FileText },
  { name: "Job Orders", href: "/job-orders", icon: Briefcase },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { name: "Invoices", href: "/invoices", icon: Receipt },
  { name: "Messages", href: "/messages", icon: Send },
  { name: "QuickBooks", href: "/settings/quickbooks", icon: Link2 },
];

const vendorsNavigation = [
  { name: "All Vendors", href: "/vendors", icon: Truck },
  { name: "Vendor Bills", href: "/vendor-bills", icon: Receipt },
  { name: "Vendor Documents", href: "/vendor-documents", icon: FileText },
  { name: "Contractor Submissions", href: "/admin/contractor-submissions", icon: ClipboardCheck },
];

const staffingNavigation = [
  { name: "Time Tracking", href: "/time-tracking", icon: Clock },
  { name: "Project Assignments", href: "/project-assignments", icon: UserCog, requiresManager: true },
  { name: "Badge Templates", href: "/badge-templates", icon: IdCard, requiresManager: true },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin, isManager } = useUserRole();

  // Collapsible state
  const [vendorsOpen, setVendorsOpen] = useState(false);
  const [staffingOpen, setStaffingOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Auto-expand section if current route is within it
  useEffect(() => {
    const vendorsRoutes = vendorsNavigation.map((item) => item.href);
    const staffingRoutes = staffingNavigation.map((item) => item.href);
    const accountRoutes = ["/user-management", "/settings"];

    if (vendorsRoutes.some((r) => location.pathname === r || location.pathname.startsWith(r))) setVendorsOpen(true);
    if (staffingRoutes.some((r) => location.pathname === r)) setStaffingOpen(true);
    if (accountRoutes.some((r) => location.pathname === r || location.pathname.startsWith(r))) setAccountOpen(true);
  }, [location.pathname]);

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
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
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

          {/* Vendors Section */}
          <Collapsible open={vendorsOpen} onOpenChange={setVendorsOpen}>
            <div className="mt-4 pt-4 border-t border-sidebar-border">
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                <span>Vendors</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    vendorsOpen && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1">
                {vendorsNavigation.map((item) => {
                  const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
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
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Staffing Section */}
          <Collapsible open={staffingOpen} onOpenChange={setStaffingOpen}>
            <div className="mt-4 pt-4 border-t border-sidebar-border">
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                <span>Staffing</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    staffingOpen && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1">
                {staffingNavigation.map((item) => {
                  if (item.requiresManager && !isAdmin && !isManager) return null;
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
              </CollapsibleContent>
            </div>
          </Collapsible>
        </nav>

        {/* Account Section */}
        <div className="border-t border-sidebar-border p-3">
          <Collapsible open={accountOpen} onOpenChange={setAccountOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
              <span>Account</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  accountOpen && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1">
              {user && (
                <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground">
                  <span className="truncate">{user.email}</span>
                </div>
              )}
              <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all duration-200 cursor-pointer">
                <ThemeToggle />
                <span>Toggle Theme</span>
              </div>
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
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  location.pathname === "/settings"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
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
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </aside>
  );
}
