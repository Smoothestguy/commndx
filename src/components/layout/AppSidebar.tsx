import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissionCheck } from "@/hooks/usePermissionCheck";
import { useUIDensity } from "@/contexts/UIDensityContext";
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
  Eye,
  ScrollText,
  ClipboardList,
  FolderSearch,
  History,
  MessageCircle,
  Trash2,
} from "lucide-react";
import logo from "@/assets/logo.png";
import logoDark from "@/assets/logo-dark.png";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Products", href: "/products", icon: Package },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Personnel", href: "/personnel", icon: Users },
  { name: "Estimates", href: "/estimates", icon: FileText },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { name: "Invoices", href: "/invoices", icon: Receipt },
  { name: "Messages", href: "/messages", icon: MessageCircle },
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
    name: "Applications",
    href: "/staffing/applications",
    icon: ClipboardList,
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
  const { isAdmin, isManager, isAccounting } = useUserRole();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { isSpreadsheetMode, is2K1Mode, isCompactMode } = useUIDensity();
  const { resolvedTheme } = useTheme();

  // Permission checks for admin modules
  const userMgmtPerms = usePermissionCheck('user_management');
  const permsMgmtPerms = usePermissionCheck('permissions_management');
  const auditLogsPerms = usePermissionCheck('audit_logs');
  const documentCenterPerms = usePermissionCheck('document_center');

  // Collapsible state for sections
  const [vendorsOpen, setVendorsOpen] = useState(false);
  const [staffingOpen, setStaffingOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  
  // Compact mode class helpers
  // Spreadsheet: Ultra compact (h-7, text-xs, py-1)
  // 2K1: Condensed (~30% tighter than normal, h-8, text-[13px])
  const getMenuButtonClass = () => {
    if (isSpreadsheetMode) return "h-7 text-xs py-1";
    if (is2K1Mode) return "h-8 text-[13px] py-1";
    return "";
  };
  
  const getIconClass = () => {
    if (isSpreadsheetMode) return "h-3.5 w-3.5";
    if (is2K1Mode) return "h-3.5 w-3.5";
    return "h-4 w-4";
  };
  
  const getGroupLabelClass = () => {
    if (isSpreadsheetMode) return "text-[10px] py-1";
    if (is2K1Mode) return "text-[11px] py-1";
    return "";
  };

  const menuButtonClass = getMenuButtonClass();
  const iconClass = getIconClass();
  const groupLabelClass = getGroupLabelClass();

  // Auto-expand section if current route is within it
  useEffect(() => {
    const vendorsRoutes = vendorsNavigation.map((item) => item.href);
    const staffingRoutes = staffingNavigation.map((item) => item.href);
    const accountRoutes = ["/user-management", "/settings", "/permissions", "/admin/preview", "/document-center"];

    if (
      vendorsRoutes.some(
        (r) => location.pathname === r || location.pathname.startsWith(r)
      )
    )
      setVendorsOpen(true);
    if (staffingRoutes.some((r) => location.pathname === r) || location.pathname.startsWith("/staffing/"))
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
            "flex items-center gap-2 px-3 py-2",
            isCollapsed && "justify-center"
          )}
        >
          <img
            src={resolvedTheme === "light" ? logoDark : logo}
            alt="Fairfield"
            className="object-contain transition-all duration-200 h-10 w-auto max-w-[160px] group-data-[state=collapsed]:h-6 group-data-[state=collapsed]:w-6 group-data-[state=collapsed]:max-w-[24px]"
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
                      className={cn(
                        isActive && "bg-primary/15 text-primary",
                        menuButtonClass
                      )}
                    >
                      <Link to={item.href}>
                        <item.icon className={iconClass} />
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
            <SidebarGroupLabel asChild className={groupLabelClass}>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span>Vendors</span>
                <ChevronDown
                  className={cn(
                    "transition-transform duration-200",
                    isSpreadsheetMode ? "h-3 w-3" : "h-4 w-4",
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
                          className={menuButtonClass}
                        >
                          <Link to={item.href}>
                            <item.icon className={iconClass} />
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
            <SidebarGroupLabel asChild className={groupLabelClass}>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span>Staffing</span>
                <ChevronDown
                  className={cn(
                    "transition-transform duration-200",
                    isSpreadsheetMode ? "h-3 w-3" : "h-4 w-4",
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
                          className={menuButtonClass}
                        >
                          <Link to={item.href}>
                            <item.icon className={iconClass} />
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
            <SidebarGroupLabel asChild className={groupLabelClass}>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span>Account</span>
                <ChevronDown
                  className={cn(
                    "transition-transform duration-200",
                    isSpreadsheetMode ? "h-3 w-3" : "h-4 w-4",
                    accountOpen && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* User Management - show if admin OR has permission */}
                  {(isAdmin || userMgmtPerms.canView) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/user-management"}
                        tooltip="User Management"
                        className={menuButtonClass}
                      >
                        <Link to="/user-management">
                          <Shield className={iconClass} />
                          <span>User Management</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  
                  {/* Permissions Management - show if admin OR has permission */}
                  {(isAdmin || permsMgmtPerms.canView) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/permissions"}
                        tooltip="Permissions"
                        className={menuButtonClass}
                      >
                        <Link to="/permissions">
                          <KeyRound className={iconClass} />
                          <span>Permissions</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  
                  {/* Admin-only features (portal previews) */}
                  {isAdmin && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname === "/admin/preview/vendor-portal"}
                          tooltip="Vendor Portal Preview"
                          className={menuButtonClass}
                        >
                          <Link to="/admin/preview/vendor-portal">
                            <Eye className={iconClass} />
                            <span>Vendor Portal Preview</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname === "/admin/preview/personnel-portal"}
                          tooltip="Personnel Portal Preview"
                          className={menuButtonClass}
                        >
                          <Link to="/admin/preview/personnel-portal">
                            <Eye className={iconClass} />
                            <span>Personnel Portal Preview</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}
                  
                  {/* Audit Logs - show if admin OR has permission */}
                  {(isAdmin || auditLogsPerms.canView) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/admin/audit-logs"}
                        tooltip="Audit Logs"
                        className={menuButtonClass}
                      >
                        <Link to="/admin/audit-logs">
                          <ScrollText className={iconClass} />
                          <span>Audit Logs</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  
                  {/* Trash - show if admin OR manager */}
                  {(isAdmin || isManager) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/admin/trash"}
                        tooltip="Trash"
                        className={menuButtonClass}
                      >
                        <Link to="/admin/trash">
                          <Trash2 className={iconClass} />
                          <span>Trash</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  
                  {/* Document Center - show if admin/manager/accounting OR has permission */}
                  {(isAdmin || isManager || isAccounting || documentCenterPerms.canView) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/document-center"}
                        tooltip="Document Center"
                        className={menuButtonClass}
                      >
                        <Link to="/document-center">
                          <FolderSearch className={iconClass} />
                          <span>Document Center</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/activity-history"}
                      tooltip="Activity History"
                      className={menuButtonClass}
                    >
                      <Link to="/activity-history">
                        <History className={iconClass} />
                        <span>Activity History</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/settings"}
                      tooltip="Settings"
                      className={menuButtonClass}
                    >
                      <Link to="/settings">
                        <Settings className={iconClass} />
                        <span>Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={signOut} tooltip="Sign Out" className={menuButtonClass}>
                      <LogOut className={iconClass} />
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
