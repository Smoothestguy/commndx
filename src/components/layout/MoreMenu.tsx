import { 
  Users, Package, ShoppingCart, Settings, UserCog, LogOut, 
  Clock, UserCheck, IdCard, Link2, Receipt,
  FolderKanban, FileText, ClipboardList, MessageCircle, DollarSign,
  LucideIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface MoreMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MenuItem {
  icon: LucideIcon;
  label: string;
  path: string;
  color: string;
  requiresManager?: boolean;
  requiresAdmin?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    title: "People",
    items: [
      { icon: Users, label: "Customers", path: "/customers", color: "text-blue-500" },
      { icon: UserCheck, label: "Personnel", path: "/personnel", color: "text-cyan-500" },
    ],
  },
  {
    title: "Projects",
    items: [
      { icon: FolderKanban, label: "All Projects", path: "/projects", color: "text-violet-500" },
      { icon: UserCog, label: "Assignments", path: "/project-assignments", color: "text-pink-500", requiresManager: true },
    ],
  },
  {
    title: "Vendors",
    items: [
      { icon: Users, label: "All Vendors", path: "/vendors", color: "text-purple-500" },
      { icon: Receipt, label: "Vendor Bills", path: "/vendor-bills", color: "text-amber-500" },
      { icon: FileText, label: "Documents", path: "/vendor-documents", color: "text-slate-500" },
    ],
  },
  {
    title: "Catalog",
    items: [
      { icon: Package, label: "Products", path: "/products", color: "text-green-500" },
    ],
  },
  {
    title: "Staffing",
    items: [
      { icon: Clock, label: "Time Tracking", path: "/time-tracking", color: "text-teal-500" },
      { icon: ClipboardList, label: "Applications", path: "/staffing/applications", color: "text-orange-500", requiresManager: true },
      { icon: DollarSign, label: "Reimbursements", path: "/reimbursements", color: "text-emerald-500", requiresManager: true },
      { icon: IdCard, label: "Badge Templates", path: "/badge-templates", color: "text-indigo-500", requiresManager: true },
    ],
  },
  {
    title: "Communication",
    items: [
      { icon: MessageCircle, label: "Messages", path: "/messages", color: "text-sky-500" },
    ],
  },
  {
    title: "Operations",
    items: [
      { icon: ShoppingCart, label: "Purchase Orders", path: "/purchase-orders", color: "text-orange-500" },
      { icon: Link2, label: "QuickBooks", path: "/settings/quickbooks", color: "text-green-600" },
    ],
  },
];

export function MoreMenu({ open, onOpenChange }: MoreMenuProps) {
  const navigate = useNavigate();
  const { isAdmin, isManager } = useUserRole();
  const { signOut } = useAuth();

  const handleNavigation = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const handleSignOut = async () => {
    onOpenChange(false);
    await signOut();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl overflow-hidden">
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-8 pb-32 overflow-y-auto h-[calc(85vh-80px)] safe-area-bottom">
          {menuSections.map((section) => {
            // Filter items based on role requirements
            const visibleItems = section.items.filter(item => {
              if (item.requiresManager && !isAdmin && !isManager) return false;
              if (item.requiresAdmin && !isAdmin) return false;
              return true;
            });

            // Skip section if no visible items
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">
                  {section.title}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNavigation(item.path)}
                        className="flex flex-col items-center gap-3 p-6 rounded-2xl glass hover:bg-muted/50 transition-all active:scale-95"
                      >
                        <div className={`p-4 rounded-full bg-background/50 ${item.color}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className="text-sm font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">
              Account
            </h3>
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => handleNavigation("/settings")}
              >
                <Settings className="mr-3 h-5 w-5" />
                Settings
              </Button>
              
              {isAdmin && (
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => handleNavigation("/user-management")}
                >
                  <UserCog className="mr-3 h-5 w-5" />
                  User Management
                </Button>
              )}

              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
