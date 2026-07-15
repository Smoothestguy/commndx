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
  KeyRound,
  Eye,
  ScrollText,
  FolderSearch,
  History,
  MessageCircle,
  Trash2,
  Copy as CopyIcon,
} from "lucide-react";
import logo from "@/assets/logo.png";
import logoDark from "@/assets/logo-dark.png";

type NavItem = {
  name: string;
  href: string;
  icon: any;
  requiresManager?: boolean;
};

const salesNav: NavItem[] = [
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Estimates", href: "/estimates", icon: FileText },
  { name: "Invoices", href: "/invoices", icon: Receipt },
  { name: "Products & Services", href: "/products", icon: Package },
];

const operationsNav: NavItem[] = [
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Crew Assignments", href: "/project-assignments", icon: UserCog },
  { name: "Time Tracking", href: "/time-tracking", icon: Clock },
];

const recruitingNav: NavItem[] = [
  { name: "Job Postings", href: "/staffing/applications", icon: Briefcase, requiresManager: true },
  { name: "Applicant Pool", href: "/staffing/applicants", icon: Users, requiresManager: true },
  { name: "Duplicates", href: "/staffing/duplicates", icon: CopyIcon, requiresManager: true },
  { name: "Form Templates", href: "/staffing/form-templates", icon: FileText, requiresManager: true },
  { name: "Badges", href: "/badge-templates", icon: IdCard, requiresManager: true },
];

const workforceNav: NavItem[] = [
  { name: "Personnel", href: "/personnel", icon: Users },
  { name: "Messages", href: "/messages", icon: MessageCircle },
];

const vendorsNav: NavItem[] = [
  { name: "Vendors", href: "/vendors", icon: Truck },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { name: "Bills", href: "/vendor-bills", icon: Receipt },
  { name: "Documents", href: "/vendor-documents", icon: FileText },
  { name: "Submissions", href: "/admin/contractor-submissions", icon: ClipboardCheck },
];

type GroupKey = "sales" | "operations" | "recruiting" | "workforce" | "vendors" | "administration";

const readGroupOpen = (key: GroupKey, fallback: boolean) => {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(`sidebar-group-${key}`);
    if (v === "true") return true;
    if (v === "false") return false;
  } catch { /* ignore */ }
  return fallback;
};

const writeGroupOpen = (key: GroupKey, value: boolean) => {
  try {
    window.localStorage.setItem(`sidebar-group-${key}`, String(value));
  } catch { /* ignore */ }
};

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin, isManager, isAccounting } = useUserRole();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { isSpreadsheetMode, is2K1Mode } = useUIDensity();
  const { resolvedTheme } = useTheme();

  const userMgmtPerms = usePermissionCheck('user_management');
  const permsMgmtPerms = usePermissionCheck('permissions_management');
  const auditLogsPerms = usePermissionCheck('audit_logs');
  const documentCenterPerms = usePermissionCheck('document_center');

  const [salesOpen, setSalesOpen] = useState(() => readGroupOpen("sales", true));
  const [operationsOpen, setOperationsOpen] = useState(() => readGroupOpen("operations", true));
  const [recruitingOpen, setRecruitingOpen] = useState(() => readGroupOpen("recruiting", false));
  const [workforceOpen, setWorkforceOpen] = useState(() => readGroupOpen("workforce", false));
  const [vendorsOpen, setVendorsOpen] = useState(() => readGroupOpen("vendors", false));
  const [adminOpen, setAdminOpen] = useState(() => readGroupOpen("administration", false));

  const setGroup = (key: GroupKey, setter: (v: boolean) => void) => (v: boolean) => {
    setter(v);
    writeGroupOpen(key, v);
  };

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

  // Auto-expand group containing active route
  useEffect(() => {
    const match = (items: NavItem[]) =>
      items.some(i => location.pathname === i.href || location.pathname.startsWith(i.href + "/"));
    if (match(salesNav)) { setSalesOpen(true); writeGroupOpen("sales", true); }
    if (match(operationsNav)) { setOperationsOpen(true); writeGroupOpen("operations", true); }
    if (match(recruitingNav) || location.pathname.startsWith("/staffing/")) {
      setRecruitingOpen(true); writeGroupOpen("recruiting", true);
    }
    if (match(workforceNav)) { setWorkforceOpen(true); writeGroupOpen("workforce", true); }
    if (match(vendorsNav)) { setVendorsOpen(true); writeGroupOpen("vendors", true); }
    const adminRoutes = ["/user-management", "/settings", "/permissions", "/admin/preview", "/admin/audit-logs", "/admin/trash", "/document-center", "/activity-history"];
    if (adminRoutes.some(r => location.pathname === r || location.pathname.startsWith(r))) {
      setAdminOpen(true); writeGroupOpen("administration", true);
    }
  }, [location.pathname]);

  const renderGroup = (
    label: string,
    open: boolean,
    setOpen: (v: boolean) => void,
    items: NavItem[]
  ) => {
    const visible = items.filter(i => !i.requiresManager || isAdmin || isManager);
    if (visible.length === 0) return null;
    return (
      <SidebarGroup>
        <Collapsible open={open} onOpenChange={setOpen}>
          <SidebarGroupLabel asChild className={groupLabelClass}>
            <CollapsibleTrigger className="flex w-full items-center justify-between">
              <span>{label}</span>
              <ChevronDown
                className={cn(
                  "transition-transform duration-200",
                  isSpreadsheetMode ? "h-3 w-3" : "h-4 w-4",
                  open && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                {visible.map((item) => {
                  const isActive =
                    location.pathname === item.href ||
                    location.pathname.startsWith(item.href + "/");
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.name}
                        className={cn(isActive && "bg-primary/15 text-primary", menuButtonClass)}
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
    );
  };

  const dashActive = location.pathname === "/";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
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
        {/* Dashboard - ungrouped */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={dashActive}
                  tooltip="Dashboard"
                  className={cn(dashActive && "bg-primary/15 text-primary", menuButtonClass)}
                >
                  <Link to="/">
                    <LayoutDashboard className={iconClass} />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {renderGroup("Sales", salesOpen, setGroup("sales", setSalesOpen), salesNav)}
        {renderGroup("Operations", operationsOpen, setGroup("operations", setOperationsOpen), operationsNav)}
        {renderGroup("Recruiting", recruitingOpen, setGroup("recruiting", setRecruitingOpen), recruitingNav)}
        {renderGroup("Workforce", workforceOpen, setGroup("workforce", setWorkforceOpen), workforceNav)}
        {renderGroup("Vendors & Purchasing", vendorsOpen, setGroup("vendors", setVendorsOpen), vendorsNav)}
      </SidebarContent>

      {/* Footer: Administration */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarGroup>
          <Collapsible open={adminOpen} onOpenChange={setGroup("administration", setAdminOpen)}>
            <SidebarGroupLabel asChild className={groupLabelClass}>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span>Administration</span>
                <ChevronDown
                  className={cn(
                    "transition-transform duration-200",
                    isSpreadsheetMode ? "h-3 w-3" : "h-4 w-4",
                    adminOpen && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
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
                      isActive={location.pathname === "/settings/quickbooks"}
                      tooltip="QuickBooks"
                      className={menuButtonClass}
                    >
                      <Link to="/settings/quickbooks">
                        <Link2 className={iconClass} />
                        <span>QuickBooks</span>
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
