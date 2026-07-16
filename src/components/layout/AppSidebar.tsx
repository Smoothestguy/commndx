import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  Clock,
  Map,
  Send,
  UserSearch,
  Users,
  MessageSquareText,
  Receipt,
  CalendarClock,
  Building2,
  FileText,
  FileSpreadsheet,
  Package,
  Truck,
  ShoppingCart,
  FileCheck2,
  FolderSearch,
  CheckSquare,
  BarChart3,
  TrendingDown,
  FolderOpen,
  UserCog,
  KeyRound,
  ScrollText,
  Trash2,
  ClipboardType,
  IdCard,
  Copy,
  Send as SendIcon,
  Link2,
  Settings,
  Eye,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useUserRole } from "@/hooks/useUserRole";
import { useTotalUnreadCount } from "@/integrations/supabase/hooks/useConversations";
import { cn } from "@/lib/utils";

type Item = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAdmin?: boolean;
  requiresManager?: boolean;
  badge?: "unread";
};

type Section = {
  title?: string;
  items: Item[];
  requiresAdmin?: boolean;
  requiresManager?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

const sections: Section[] = [
  {
    items: [{ name: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    title: "Operations",
    items: [
      { name: "Projects", href: "/projects", icon: FolderKanban },
      { name: "Crew Assignments", href: "/project-assignments", icon: ClipboardList, requiresManager: true },
      { name: "Time Tracking", href: "/time-tracking", icon: Clock },
      { name: "Staffing Map", href: "/staffing/map", icon: Map, requiresManager: true },
    ],
  },
  {
    title: "Recruiting",
    requiresManager: true,
    items: [
      { name: "Job Postings", href: "/staffing/applications", icon: Send },
      { name: "Applicant Pool", href: "/staffing/applicants", icon: UserSearch },
    ],
  },
  {
    title: "Workforce",
    items: [
      { name: "Personnel", href: "/personnel", icon: Users },
      { name: "Messages", href: "/messages", icon: MessageSquareText, badge: "unread" },
      { name: "Reimbursements", href: "/reimbursements", icon: Receipt },
      { name: "Team Timesheet", href: "/team-timesheet", icon: CalendarClock },
    ],
  },
  {
    title: "Sales",
    items: [
      { name: "Customers", href: "/customers", icon: Building2 },
      { name: "Estimates", href: "/estimates", icon: FileText },
      { name: "Invoices", href: "/invoices", icon: FileSpreadsheet },
      { name: "Products & Services", href: "/products", icon: Package },
    ],
  },
  {
    title: "Purchasing",
    items: [
      { name: "Vendors", href: "/vendors", icon: Truck },
      { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
      { name: "Bills", href: "/vendor-bills", icon: FileCheck2 },
      { name: "Vendor Documents", href: "/vendor-documents", icon: FolderSearch },
      { name: "Completion Reviews", href: "/completion-reviews", icon: CheckSquare, requiresAdmin: true },
    ],
  },
  {
    title: "Reports",
    items: [
      { name: "Reports Hub", href: "/reports", icon: BarChart3 },
      { name: "Overhead Analysis", href: "/overhead-analysis", icon: TrendingDown, requiresManager: true },
      { name: "Document Center", href: "/document-center", icon: FolderOpen },
    ],
  },
  {
    title: "Admin",
    requiresAdmin: true,
    collapsible: true,
    defaultOpen: false,
    items: [
      { name: "User Management", href: "/user-management", icon: UserCog },
      { name: "Permissions", href: "/permissions", icon: KeyRound },
      { name: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
      { name: "Trash", href: "/admin/trash", icon: Trash2 },
      { name: "Form Templates", href: "/staffing/form-templates", icon: ClipboardType },
      { name: "Badges", href: "/badge-templates", icon: IdCard },
      { name: "Duplicates", href: "/staffing/duplicates", icon: Copy },
      { name: "Contractor Submissions", href: "/admin/contractor-submissions", icon: SendIcon },
      { name: "QuickBooks", href: "/settings/quickbooks", icon: Link2 },
      { name: "Settings", href: "/settings", icon: Settings },
      { name: "Vendor Portal Preview", href: "/admin/preview/vendor-portal", icon: Eye },
      { name: "Personnel Portal Preview", href: "/admin/preview/personnel-portal", icon: Eye },
    ],
  },
];

function isItemVisible(item: Item, isAdmin: boolean, isManager: boolean) {
  if (item.requiresAdmin && !isAdmin) return false;
  if (item.requiresManager && !(isAdmin || isManager)) return false;
  return true;
}

function SidebarNavItem({ item, isActive, unreadCount }: { item: Item; isActive: boolean; unreadCount: number }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
        <NavLink to={item.href} end={item.href === "/"}>
          <Icon className="h-4 w-4" />
          <span>{item.name}</span>
        </NavLink>
      </SidebarMenuButton>
      {item.badge === "unread" && unreadCount > 0 && (
        <SidebarMenuBadge className="bg-destructive text-destructive-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const { isAdmin, isManager } = useUserRole();
  const { data: unreadCount = 0 } = useTotalUnreadCount();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [adminOpen, setAdminOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-12 border-b border-sidebar-border" />
      <SidebarContent>
        {sections.map((section, idx) => {
          if (section.requiresAdmin && !isAdmin) return null;
          if (section.requiresManager && !(isAdmin || isManager)) return null;

          const visibleItems = section.items.filter((i) => isItemVisible(i, isAdmin, isManager));
          if (visibleItems.length === 0) return null;

          if (section.collapsible) {
            return (
              <Collapsible
                key={idx}
                open={adminOpen}
                onOpenChange={setAdminOpen}
                className="group/collapsible"
              >
                <SidebarGroup>
                  <SidebarGroupLabel asChild>
                    <CollapsibleTrigger className="flex w-full items-center justify-between">
                      {section.title}
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          adminOpen && "rotate-180",
                        )}
                      />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {visibleItems.map((item) => (
                          <SidebarNavItem
                            key={item.href}
                            item={item}
                            isActive={isActive(item.href)}
                            unreadCount={unreadCount}
                          />
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          }

          return (
            <SidebarGroup key={idx}>
              {section.title && <SidebarGroupLabel>{section.title}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarNavItem
                      key={item.href}
                      item={item}
                      isActive={isActive(item.href)}
                      unreadCount={unreadCount}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
