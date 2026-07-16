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
} from "lucide-react";

export type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAdmin?: boolean;
  requiresManager?: boolean;
  badge?: "unread";
};

export type NavSection = {
  title?: string;
  items: NavItem[];
  requiresAdmin?: boolean;
  requiresManager?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export const sections: NavSection[] = [
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

export function isItemVisible(item: NavItem, isAdmin: boolean, isManager: boolean) {
  if (item.requiresAdmin && !isAdmin) return false;
  if (item.requiresManager && !(isAdmin || isManager)) return false;
  return true;
}

export function isSectionVisible(section: NavSection, isAdmin: boolean, isManager: boolean) {
  if (section.requiresAdmin && !isAdmin) return false;
  if (section.requiresManager && !(isAdmin || isManager)) return false;
  return true;
}
