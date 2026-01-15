import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissionCheck } from "@/hooks/usePermissionCheck";
import { ChevronDown } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  ShoppingCart,
  ClipboardList,
  Users,
  Truck,
  Package,
  FolderKanban,
  Clock,
  UserCog,
  IdCard,
  Shield,
  KeyRound,
  ScrollText,
  FolderSearch,
  Settings,
  Link2,
  Eye,
  Send,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  requiresAdmin?: boolean;
  requiresManager?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Menu structure mapped from current sidebar
const transactionsMenu: NavSection[] = [
  {
    title: "Sales",
    items: [
      { name: "Estimates", href: "/estimates", icon: FileText, description: "Create and manage estimates" },
      { name: "Invoices", href: "/invoices", icon: Receipt, description: "Manage customer invoices" },
    ],
  },
  {
    title: "Purchasing",
    items: [
      { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart, description: "Manage vendor purchase orders" },
      { name: "Vendor Bills", href: "/vendor-bills", icon: Receipt, description: "Track vendor bills and payments" },
    ],
  },
];

const listsMenu: NavSection[] = [
  {
    title: "Relationships",
    items: [
      { name: "Customers", href: "/customers", icon: Users, description: "Manage customer accounts" },
      { name: "Vendors", href: "/vendors", icon: Truck, description: "Manage vendor relationships" },
      { name: "Personnel", href: "/personnel", icon: Users, description: "Manage staff and workers" },
    ],
  },
  {
    title: "Items",
    items: [
      { name: "Products", href: "/products", icon: Package, description: "Products and services catalog" },
      { name: "Projects", href: "/projects", icon: FolderKanban, description: "Manage active projects" },
    ],
  },
];

const reportsMenu: NavSection[] = [
  {
    title: "Operations",
    items: [
      { name: "Time Tracking", href: "/time-tracking", icon: Clock, description: "Track and manage time entries" },
      { name: "Project Assignments", href: "/project-assignments", icon: UserCog, description: "Manage personnel assignments", requiresManager: true },
      { name: "Applications", href: "/staffing/applications", icon: ClipboardList, description: "Review job applications", requiresManager: true },
    ],
  },
  {
    title: "Documents",
    items: [
      { name: "Vendor Documents", href: "/vendor-documents", icon: FileText, description: "Vendor document management" },
      { name: "Document Center", href: "/document-center", icon: FolderSearch, description: "Central document repository" },
      { name: "Messages", href: "/messages", icon: Send, description: "Internal messaging" },
    ],
  },
];

const setupMenu: NavSection[] = [
  {
    title: "Administration",
    items: [
      { name: "User Management", href: "/user-management", icon: Shield, description: "Manage users and roles", requiresAdmin: true },
      { name: "Permissions", href: "/permissions", icon: KeyRound, description: "Configure permissions", requiresAdmin: true },
      { name: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText, description: "View system audit logs", requiresAdmin: true },
    ],
  },
  {
    title: "Settings",
    items: [
      { name: "Badge Templates", href: "/badge-templates", icon: IdCard, description: "Design employee badges", requiresManager: true },
      { name: "QuickBooks", href: "/settings/quickbooks", icon: Link2, description: "QuickBooks integration" },
      { name: "Settings", href: "/settings", icon: Settings, description: "System settings" },
    ],
  },
  {
    title: "Previews",
    items: [
      { name: "Vendor Portal Preview", href: "/admin/preview/vendor-portal", icon: Eye, description: "Preview vendor portal", requiresAdmin: true },
      { name: "Personnel Portal Preview", href: "/admin/preview/personnel-portal", icon: Eye, description: "Preview personnel portal", requiresAdmin: true },
    ],
  },
];

interface MegaMenuSectionProps {
  sections: NavSection[];
  isOpen: boolean;
  menuTextColor?: string;
}

function MegaMenuSection({ sections, isOpen, menuTextColor }: MegaMenuSectionProps) {
  const { isAdmin, isManager } = useUserRole();
  const location = useLocation();

  return (
    <div className="grid gap-3 p-4 w-[500px] lg:w-[600px] grid-cols-2">
      {sections.map((section) => {
        const filteredItems = section.items.filter((item) => {
          if (item.requiresAdmin && !isAdmin) return false;
          if (item.requiresManager && !isAdmin && !isManager) return false;
          return true;
        });

        if (filteredItems.length === 0) return null;

        return (
          <div key={section.title} className="space-y-2">
            <h4 
              className="text-xs font-semibold uppercase tracking-wide px-2"
              style={{ color: menuTextColor ? `${menuTextColor}99` : undefined }}
            >
              {section.title}
            </h4>
            <div className="space-y-1">
              {filteredItems.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-start gap-3 rounded-md p-2 text-sm transition-colors hover:bg-accent/20",
                      isActive && "bg-accent/30"
                    )}
                    style={{ color: menuTextColor || undefined }}
                  >
                    <item.icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <div className="font-medium leading-none">{item.name}</div>
                      {item.description && (
                        <p 
                          className="text-xs line-clamp-1"
                          style={{ color: menuTextColor ? `${menuTextColor}99` : undefined }}
                        >
                          {item.description}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface MegaMenuProps {
  menuBackground?: string;
  menuTextColor?: string;
}

export function MegaMenu({ menuBackground, menuTextColor }: MegaMenuProps) {
  const location = useLocation();

  const menuContentStyle = {
    backgroundColor: menuBackground || undefined,
    color: menuTextColor || undefined,
  };

  return (
    <NavigationMenu>
      <NavigationMenuList>
        {/* Home */}
        <NavigationMenuItem>
          <NavigationMenuLink
            asChild
            className={cn(
              navigationMenuTriggerStyle(),
              "bg-transparent text-header-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:text-header-foreground",
              location.pathname === "/" && "bg-black/10 dark:bg-white/10"
            )}
          >
            <Link to="/">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Home
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>

        {/* Transactions */}
        <NavigationMenuItem>
          <NavigationMenuTrigger
            className={cn(
              "bg-transparent text-header-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:text-header-foreground data-[state=open]:bg-black/10 dark:data-[state=open]:bg-white/10",
              ["/estimates", "/invoices", "/purchase-orders", "/vendor-bills", "/change-orders"].some(
                (p) => location.pathname.startsWith(p)
              ) && "bg-black/10 dark:bg-white/10"
            )}
          >
            Transactions
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div style={menuContentStyle} className={cn(!menuBackground && "bg-popover")}>
              <MegaMenuSection sections={transactionsMenu} isOpen menuTextColor={menuTextColor} />
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Lists */}
        <NavigationMenuItem>
          <NavigationMenuTrigger
            className={cn(
              "bg-transparent text-header-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:text-header-foreground data-[state=open]:bg-black/10 dark:data-[state=open]:bg-white/10",
              ["/customers", "/vendors", "/personnel", "/products", "/projects"].some(
                (p) => location.pathname.startsWith(p)
              ) && "bg-black/10 dark:bg-white/10"
            )}
          >
            Lists
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div style={menuContentStyle} className={cn(!menuBackground && "bg-popover")}>
              <MegaMenuSection sections={listsMenu} isOpen menuTextColor={menuTextColor} />
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Reports */}
        <NavigationMenuItem>
          <NavigationMenuTrigger
            className={cn(
              "bg-transparent text-header-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:text-header-foreground data-[state=open]:bg-black/10 dark:data-[state=open]:bg-white/10",
              ["/time-tracking", "/project-assignments", "/staffing", "/vendor-documents", "/document-center", "/messages"].some(
                (p) => location.pathname.startsWith(p)
              ) && "bg-black/10 dark:bg-white/10"
            )}
          >
            Reports
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div style={menuContentStyle} className={cn(!menuBackground && "bg-popover")}>
              <MegaMenuSection sections={reportsMenu} isOpen menuTextColor={menuTextColor} />
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Setup */}
        <NavigationMenuItem>
          <NavigationMenuTrigger
            className={cn(
              "bg-transparent text-header-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:text-header-foreground data-[state=open]:bg-black/10 dark:data-[state=open]:bg-white/10",
              ["/user-management", "/permissions", "/admin", "/badge-templates", "/settings"].some(
                (p) => location.pathname.startsWith(p)
              ) && "bg-black/10 dark:bg-white/10"
            )}
          >
            Setup
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div style={menuContentStyle} className={cn(!menuBackground && "bg-popover")}>
              <MegaMenuSection sections={setupMenu} isOpen menuTextColor={menuTextColor} />
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
