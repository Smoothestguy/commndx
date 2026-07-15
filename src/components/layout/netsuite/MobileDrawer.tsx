import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  ShoppingCart,
  LogOut,
  Shield,
  Clock,
  UserCog,
  ClipboardList,
  IdCard,
  Link2,
  KeyRound,
  ScrollText,
  FolderSearch,
  Send,
  BarChart3,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const mainNavigation = [
  { name: "Home", href: "/", icon: LayoutDashboard },
];

const salesNavigation = [
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Estimates", href: "/estimates", icon: FileText },
  { name: "Invoices", href: "/invoices", icon: Receipt },
  { name: "Products & Services", href: "/products", icon: Package },
];

const operationsNavigation = [
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Crew Assignments", href: "/project-assignments", icon: UserCog, requiresManager: true },
  { name: "Time Tracking", href: "/time-tracking", icon: Clock },
];

const recruitingNavigation = [
  { name: "Job Postings", href: "/staffing/applications", icon: ClipboardList, requiresManager: true },
  { name: "Applicant Pool", href: "/staffing/applicants", icon: Users, requiresManager: true },
  { name: "Duplicates", href: "/staffing/duplicates", icon: FolderSearch, requiresAdmin: true },
  { name: "Form Templates", href: "/staffing/form-templates", icon: FileText, requiresManager: true },
  { name: "Badges", href: "/badge-templates", icon: IdCard, requiresManager: true },
];

const workforceNavigation = [
  { name: "Personnel", href: "/personnel", icon: Users },
  { name: "Messages", href: "/messages", icon: Send },
];

const vendorsNavigation = [
  { name: "Vendors", href: "/vendors", icon: Truck },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { name: "Bills", href: "/vendor-bills", icon: Receipt },
  { name: "Documents", href: "/vendor-documents", icon: FileText },
  { name: "Submissions", href: "/admin/contractor-submissions", icon: FolderSearch, requiresAdmin: true },
];

const reportsNavigation = [
  { name: "Reports Hub", href: "/reports", icon: BarChart3 },
  { name: "Overhead Analysis", href: "/overhead-analysis", icon: TrendingDown, requiresManager: true },
  { name: "Document Center", href: "/document-center", icon: FolderSearch },
];

const setupNavigation = [
  { name: "User Management", href: "/user-management", icon: Shield, requiresAdmin: true },
  { name: "Permissions", href: "/permissions", icon: KeyRound, requiresAdmin: true },
  { name: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText, requiresAdmin: true },
  { name: "Document Center", href: "/document-center", icon: FolderSearch },
  { name: "QuickBooks", href: "/settings/quickbooks", icon: Link2 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin, isManager } = useUserRole();
  const [salesOpen, setSalesOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [recruitingOpen, setRecruitingOpen] = useState(false);
  const [workforceOpen, setWorkforceOpen] = useState(false);
  const [vendorsOpen, setVendorsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  const handleNavigate = () => {
    onClose();
  };

  const NavLink = ({ item }: { item: { name: string; href: string; icon: React.ComponentType<{ className?: string }>; requiresAdmin?: boolean; requiresManager?: boolean } }) => {
    if (item.requiresAdmin && !isAdmin) return null;
    if (item.requiresManager && !isAdmin && !isManager) return null;

    const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + "/");

    return (
      <Link
        to={item.href}
        onClick={handleNavigate}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <item.icon className="h-4 w-4" />
        {item.name}
      </Link>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2">
            <img src={logo} alt="Fairfield" className="h-8 w-auto" />
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100%-60px)] overflow-y-auto">
          <div className="flex-1 py-2">
            {/* Main Navigation */}
            <div className="px-2 space-y-1">
              {mainNavigation.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>

            {/* Sales */}
            <div className="mt-4 px-2">
              <Collapsible open={salesOpen} onOpenChange={setSalesOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                  <span>Sales</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", salesOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 space-y-1">
                  {salesNavigation.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Operations */}
            <div className="mt-2 px-2">
              <Collapsible open={operationsOpen} onOpenChange={setOperationsOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                  <span>Operations</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", operationsOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 space-y-1">
                  {operationsNavigation.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Recruiting */}
            <div className="mt-2 px-2">
              <Collapsible open={recruitingOpen} onOpenChange={setRecruitingOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                  <span>Recruiting</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", recruitingOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 space-y-1">
                  {recruitingNavigation.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Workforce */}
            <div className="mt-2 px-2">
              <Collapsible open={workforceOpen} onOpenChange={setWorkforceOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                  <span>Workforce</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", workforceOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 space-y-1">
                  {workforceNavigation.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Vendors */}
            <div className="mt-2 px-2">
              <Collapsible open={vendorsOpen} onOpenChange={setVendorsOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                  <span>Vendors</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", vendorsOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 space-y-1">
                  {vendorsNavigation.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Setup Section */}
            <div className="mt-2 px-2">
              <Collapsible open={setupOpen} onOpenChange={setSetupOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                  <span>Setup</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", setupOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 space-y-1">
                  {setupNavigation.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          {/* Sign Out */}
          <div className="border-t p-2">
            <Button
              variant="ghost"
              onClick={() => {
                signOut();
                onClose();
              }}
              className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
