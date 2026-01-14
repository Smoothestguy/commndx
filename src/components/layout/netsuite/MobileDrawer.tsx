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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const mainNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Products", href: "/products", icon: Package },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Personnel", href: "/personnel", icon: Users },
];

const transactionsNavigation = [
  { name: "Estimates", href: "/estimates", icon: FileText },
  { name: "Invoices", href: "/invoices", icon: Receipt },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { name: "Vendor Bills", href: "/vendor-bills", icon: Receipt },
];

const vendorsNavigation = [
  { name: "All Vendors", href: "/vendors", icon: Truck },
  { name: "Vendor Documents", href: "/vendor-documents", icon: FileText },
];

const staffingNavigation = [
  { name: "Time Tracking", href: "/time-tracking", icon: Clock },
  { name: "Project Assignments", href: "/project-assignments", icon: UserCog, requiresManager: true },
  { name: "Applications", href: "/staffing/applications", icon: ClipboardList, requiresManager: true },
  { name: "Badge Templates", href: "/badge-templates", icon: IdCard, requiresManager: true },
];

const setupNavigation = [
  { name: "User Management", href: "/user-management", icon: Shield, requiresAdmin: true },
  { name: "Permissions", href: "/permissions", icon: KeyRound, requiresAdmin: true },
  { name: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText, requiresAdmin: true },
  { name: "Document Center", href: "/document-center", icon: FolderSearch },
  { name: "QuickBooks", href: "/settings/quickbooks", icon: Link2 },
  { name: "Messages", href: "/messages", icon: Send },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin, isManager } = useUserRole();
  const [transactionsOpen, setTransactionsOpen] = useState(false);
  const [vendorsOpen, setVendorsOpen] = useState(false);
  const [staffingOpen, setStaffingOpen] = useState(false);
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

            {/* Transactions Section */}
            <div className="mt-4 px-2">
              <Collapsible open={transactionsOpen} onOpenChange={setTransactionsOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                  <span>Transactions</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", transactionsOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 space-y-1">
                  {transactionsNavigation.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Vendors Section */}
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

            {/* Staffing Section */}
            <div className="mt-2 px-2">
              <Collapsible open={staffingOpen} onOpenChange={setStaffingOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                  <span>Staffing</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", staffingOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 space-y-1">
                  {staffingNavigation.map((item) => (
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
