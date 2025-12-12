import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
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
  KeyRound,
} from "lucide-react";
import logo from "@/assets/logo.png";

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

const vendorsNavigation = [
  { name: "All Vendors", href: "/vendors", icon: Truck },
  { name: "Vendor Bills", href: "/vendor-bills", icon: Receipt },
  { name: "Vendor Documents", href: "/vendor-documents", icon: FileText },
  {
    name: "Contractor Submissions",
    href: "/admin/contractor-submissions",
    icon: ClipboardCheck,
  },
];

const staffingNavigation = [
  { name: "Time Tracking", href: "/time-tracking", icon: Clock },
  {
    name: "Project Assignments",
    href: "/project-assignments",
    icon: UserCog,
    requiresManager: true,
  },
  {
    name: "Badge Templates",
    href: "/badge-templates",
    icon: IdCard,
    requiresManager: true,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin, isManager } = useUserRole();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Collapsible state for sections
  const [vendorsOpen, setVendorsOpen] = useState(false);
  const [staffingOpen, setStaffingOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Auto-expand section if current route is within it
  useEffect(() => {
    const vendorsRoutes = vendorsNavigation.map((item) => item.href);
    const staffingRoutes = staffingNavigation.map((item) => item.href);
    const accountRoutes = ["/user-management", "/settings", "/permissions"];

    if (
      vendorsRoutes.some(
        (r) => location.pathname === r || location.pathname.startsWith(r)
      )
    )
      setVendorsOpen(true);
    if (staffingRoutes.some((r) => location.pathname === r))
      setStaffingOpen(true);
    if (
      accountRoutes.some(
        (r) => location.pathname === r || location.pathname.startsWith(r)
      )
    )
      setAccountOpen(true);
  }, [location.pathname]);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1",
            isCollapsed && "justify-center"
          )}
        >
          <img
            src={logo}
            alt="Command X"
            className={cn(
              "h-8 w-auto object-contain transition-all",
              isCollapsed ? "max-w-[32px]" : "max-w-[140px]"
            )}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                      className={cn(isActive && "bg-primary/15 text-primary")}
                    >
                      <Link to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Vendors Section */}
        <SidebarGroup>
          <Collapsible open={vendorsOpen} onOpenChange={setVendorsOpen}>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span>Vendors</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    vendorsOpen && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {vendorsNavigation.map((item) => {
                    const isActive =
                      location.pathname === item.href ||
                      location.pathname.startsWith(item.href + "/");
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.name}
                        >
                          <Link to={item.href}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Staffing Section */}
        <SidebarGroup>
          <Collapsible open={staffingOpen} onOpenChange={setStaffingOpen}>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span>Staffing</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    staffingOpen && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {staffingNavigation.map((item) => {
                    if (item.requiresManager && !isAdmin && !isManager)
                      return null;
                    const isActive = location.pathname === item.href;
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.name}
                        >
                          <Link to={item.href}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with Account Section */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarGroup>
          <Collapsible open={accountOpen} onOpenChange={setAccountOpen}>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span>Account</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    accountOpen && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {isAdmin && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname === "/user-management"}
                          tooltip="User Management"
                        >
                          <Link to="/user-management">
                            <Shield className="h-4 w-4" />
                            <span>User Management</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname === "/permissions"}
                          tooltip="Permissions"
                        >
                          <Link to="/permissions">
                            <KeyRound className="h-4 w-4" />
                            <span>Permissions</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/settings"}
                      tooltip="Settings"
                    >
                      <Link to="/settings">
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={signOut} tooltip="Sign Out">
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
