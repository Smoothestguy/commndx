import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  Clock,
  Map,
  MapPin,
  Send,
  UserSearch,
  Boxes,
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
  Star,
  Tent,
} from "lucide-react";

export type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAdmin?: boolean;
  requiresManager?: boolean;
  /** Admin, manager or accounting (financial modules). */
  requiresFinance?: boolean;
  badge?: "unread";
};

export type NavSection = {
  title?: string;
  items: NavItem[];
  requiresAdmin?: boolean;
  requiresManager?: boolean;
  requiresFinance?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

// One entry per destination. Attendance is reached from each location page.
export const sections: NavSection[] = [
  {
    title: "Operations",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Projects", href: "/projects", icon: FolderKanban },
      { name: "Locations", href: "/locations", icon: MapPin },
      { name: "Messages", href: "/messages", icon: MessageSquareText, badge: "unread" },
    ],
  },
  {
    title: "Workforce",
    requiresManager: true,
    items: [
      { name: "Personnel", href: "/personnel", icon: Users },
      { name: "Bench", href: "/personnel?segment=bench", icon: Star },
      { name: "Staffing Map", href: "/staffing/map", icon: Map, requiresManager: true },
      { name: "Crew Assignments", href: "/project-assignments", icon: ClipboardList },
      { name: "Applicant Pool", href: "/staffing/applicants", icon: UserSearch },
      { name: "Applicant Board", href: "/workforce", icon: Boxes },
      { name: "Job Postings", href: "/staffing/applications", icon: Send },
    ],
  },
  {
    title: "Time",
    items: [
      { name: "Time Tracking", href: "/time-tracking", icon: Clock },
      { name: "Team Timesheet", href: "/team-timesheet", icon: CalendarClock, requiresManager: true },
      { name: "Reimbursements", href: "/reimbursements", icon: Receipt },
    ],
  },
  {
    title: "Event Manager",
    requiresManager: true,
    items: [{ name: "Event Locations", href: "/events", icon: Tent }],
  },
  {
    title: "Sales & Financials",
    requiresFinance: true,
    collapsible: true,
    defaultOpen: false,
    items: [
      { name: "Customers", href: "/customers", icon: Building2 },
      { name: "Estimates", href: "/estimates", icon: FileText },
      { name: "Invoices", href: "/invoices", icon: FileSpreadsheet },
      { name: "Products & Services", href: "/products", icon: Package },
      { name: "Vendors & Agencies", href: "/vendors", icon: Truck },
      { name: "Work Orders", href: "/purchase-orders", icon: ShoppingCart },
      { name: "Bills", href: "/vendor-bills", icon: FileCheck2 },
      { name: "Vendor Documents", href: "/vendor-documents", icon: FolderSearch },
      { name: "Completion Reviews", href: "/completion-reviews", icon: CheckSquare, requiresAdmin: true },
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

export function isItemVisible(item: NavItem, isAdmin: boolean, isManager: boolean, isAccounting = false) {
  if (item.requiresAdmin && !isAdmin) return false;
  if (item.requiresFinance && !(isAdmin || isManager || isAccounting)) return false;
  if (item.requiresManager && !(isAdmin || isManager)) return false;
  return true;
}

export function isSectionVisible(section: NavSection, isAdmin: boolean, isManager: boolean, isAccounting = false) {
  if (section.requiresAdmin && !isAdmin) return false;
  if (section.requiresFinance && !(isAdmin || isManager || isAccounting)) return false;
  if (section.requiresManager && !(isAdmin || isManager)) return false;
  return true;
}

/** Query-aware active match so "Personnel" and "Bench" never highlight together. */
export function isNavItemActive(href: string, pathname: string, search: string) {
  const [path, query] = href.split("?");
  if (path === "/") return pathname === "/";
  const pathMatch = pathname === path || pathname.startsWith(path + "/");
  if (!pathMatch) return false;
  const params = new URLSearchParams(search);
  if (query) {
    const want = new URLSearchParams(query);
    return [...want].every(([k, v]) => params.get(k) === v);
  }
  return !(path === "/personnel" && params.get("segment") === "bench");
}
