import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ClipboardCheck,
  ChevronDown,
  IdCard,
  Link2,
  Send,
  ClipboardList,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Products", href: "/products", icon: Package },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Personnel", href: "/personnel", icon: Users },
  { name: "Estimates", href: "/estimates", icon: FileText },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { name: "Invoices", href: "/invoices", icon: Receipt },
  { name: "Messages", href: "/messages", icon: Send },
  { name: "QuickBooks", href: "/settings/quickbooks", icon: Link2 },
];

const staffingNavigation = [
  { name: "Time Tracking", href: "/time-tracking", icon: Clock },
  { name: "Project Assignments", href: "/project-assignments", icon: UserCog, requiresManager: true },
  { name: "Applications", href: "/staffing/applications", icon: ClipboardList, requiresManager: true },
  { name: "Badge Templates", href: "/badge-templates", icon: IdCard, requiresManager: true },
];

const vendorsNavigation = [
  { name: "All Vendors", href: "/vendors", icon: Truck },
  { name: "Vendor Bills", href: "/vendor-bills", icon: Receipt },
  { name: "Vendor Documents", href: "/vendor-documents", icon: FileText },
  { name: "Contractor Submissions", href: "/admin/contractor-submissions", icon: ClipboardCheck },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isAdmin, isManager } = useUserRole();

  // Collapsible state
  const [staffingOpen, setStaffingOpen] = useState(false);
  const [vendorsOpen, setVendorsOpen] = useState(false);

  // Auto-expand section if current route is within it
  useEffect(() => {
    const staffingRoutes = staffingNavigation.map((item) => item.href);
    const vendorsRoutes = vendorsNavigation.map((item) => item.href);

    if (staffingRoutes.some((r) => location.pathname === r || location.pathname.startsWith("/staffing/"))) setStaffingOpen(true);
    if (vendorsRoutes.some((r) => location.pathname === r || location.pathname.startsWith(r))) setVendorsOpen(true);
  }, [location.pathname]);

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
          className="h-9 w-9 text-header-foreground hover:bg-sidebar-accent"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-sidebar-border">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
            <span className="text-sidebar-foreground font-semibold">Menu</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  className={cn(
                    "w-full group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-primary/15 text-primary border-l-4 border-primary -ml-0.5 pl-2.5"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 transition-colors flex-shrink-0",
                      isActive ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-accent-foreground"
                    )}
                  />
                  {item.name}
                </button>
              );
            })}

            {/* Vendors Section */}
            <Collapsible open={vendorsOpen} onOpenChange={setVendorsOpen}>
              <div className="mt-4 pt-4 border-t border-sidebar-border">
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-sidebar-muted uppercase tracking-wider hover:text-sidebar-foreground transition-colors">
                  <span>Vendors</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      vendorsOpen && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 mt-1">
                  {vendorsNavigation.map((item) => {
                    const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
                    return (
                      <button
                        key={item.name}
                        onClick={() => handleNavigation(item.href)}
                        className={cn(
                          "w-full group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150",
                          isActive
                            ? "bg-primary/15 text-primary border-l-4 border-primary -ml-0.5 pl-2.5"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-5 w-5 transition-colors flex-shrink-0",
                            isActive ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-accent-foreground"
                          )}
                        />
                        {item.name}
                      </button>
                    );
                  })}
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Staffing Section */}
            <Collapsible open={staffingOpen} onOpenChange={setStaffingOpen}>
              <div className="mt-4 pt-4 border-t border-sidebar-border">
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-sidebar-muted uppercase tracking-wider hover:text-sidebar-foreground transition-colors">
                  <span>Staffing</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      staffingOpen && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 mt-1">
                  {staffingNavigation.map((item) => {
                    if (item.requiresManager && !isAdmin && !isManager) return null;
                    const isActive = location.pathname === item.href;
                    return (
                      <button
                        key={item.name}
                        onClick={() => handleNavigation(item.href)}
                        className={cn(
                          "w-full group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150",
                          isActive
                            ? "bg-primary/15 text-primary border-l-4 border-primary -ml-0.5 pl-2.5"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-5 w-5 transition-colors flex-shrink-0",
                            isActive ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-accent-foreground"
                          )}
                        />
                        {item.name}
                      </button>
                    );
                  })}
                </CollapsibleContent>
              </div>
            </Collapsible>
          </nav>

          {/* Settings & Profile */}
          <div className="border-t border-sidebar-border p-3 space-y-0.5">
            {user && (
              <div className="px-3 py-2 text-xs text-sidebar-muted truncate">
                {user.email}
              </div>
            )}
            {isAdmin && (
              <button
                onClick={() => handleNavigation("/user-management")}
                className={cn(
                  "w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  location.pathname === "/user-management"
                    ? "bg-primary/15 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Shield className="h-5 w-5 flex-shrink-0" />
                User Management
              </button>
            )}
            <button
              onClick={() => handleNavigation("/settings")}
              className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150"
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              Settings
            </button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-3 py-2.5 h-auto text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
