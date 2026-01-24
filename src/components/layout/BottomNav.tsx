import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, ClipboardList, Wallet, Grid2X2, Plus, X, FileText, Receipt, ShoppingCart, UserPlus, MessageCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "home", icon: Home, label: "Home", path: "/" },
  { id: "jobs", icon: ClipboardList, label: "Jobs", path: "/jobs" },
  { id: "fab", icon: null, label: "", path: "" }, // Center FAB placeholder
  { id: "sales", icon: Wallet, label: "Sales", path: "/sales" },
  { id: "more", icon: Grid2X2, label: "More", path: "" },
];

const quickActions = [
  { id: "estimate", icon: FileText, label: "New Estimate", path: "/estimates/new", color: "text-blue-400" },
  { id: "invoice", icon: Receipt, label: "New Invoice", path: "/invoices/new", color: "text-green-400" },
  { id: "po", icon: ShoppingCart, label: "New PO", path: "/purchase-orders/new", color: "text-purple-400" },
  { id: "customer", icon: UserPlus, label: "New Customer", path: "/customers?new=true", color: "text-orange-400" },
  { id: "message", icon: MessageCircle, label: "New Message", path: "/messages?new=true", color: "text-cyan-400" },
];

interface BottomNavProps {
  onMoreClick?: () => void;
}

const PUBLIC_ROUTES = ["/auth", "/accept-invitation", "/approve-estimate", "/apply", "/onboard", "/contractor"];
const PORTAL_ROUTES = ["/portal", "/vendor", "/subcontractor"];

export function BottomNav({ onMoreClick }: BottomNavProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  if (!isMobile) return null;
  
  // Hide on public routes
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    location.pathname.startsWith(route)
  );
  if (isPublicRoute) return null;
  
  // Hide on portal routes (personnel, vendor, subcontractor portals have their own navigation)
  const isPortalRoute = PORTAL_ROUTES.some(route => 
    location.pathname.startsWith(route)
  );
  if (isPortalRoute) return null;
  
  // Hide if user is not authenticated
  if (!user) return null;

  const isActive = (path: string) => {
    if (!path) return false;
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleActionClick = (path: string) => {
    navigate(path);
    setIsExpanded(false);
  };

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 animate-fade-in"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Quick Actions Menu */}
      {isExpanded && (
        <div className="fixed bottom-24 left-1/2 z-50 animate-quick-actions-in">
          <div className="flex flex-col gap-3 items-center">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => handleActionClick(action.path)}
                  className="group flex items-center gap-3 glass rounded-full px-4 py-3 hover:scale-105 transition-all active:scale-95 animate-fade-slide-up"
                  style={{
                    animationDelay: `${index * 60}ms`,
                    animationFillMode: 'both',
                  }}
                >
                  <div className={cn("p-2 rounded-full bg-background/50", action.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-medium text-sm whitespace-nowrap pr-2">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          if (tab.id === "fab") {
            // Docked FAB integrated into nav
            return (
              <div key={tab.id} className="flex-1 flex justify-center">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={cn(
                    "relative -mt-6",
                    "w-14 h-14 rounded-full",
                    "bg-gradient-to-br from-primary to-primary/80",
                    "shadow-[0_0_20px_hsl(var(--primary)/0.5)]",
                    "flex items-center justify-center",
                    "border-4 border-background",
                    "transition-all duration-300",
                    "active:scale-90",
                    "hover:shadow-[0_0_30px_hsl(var(--primary)/0.7)]",
                    isExpanded && "rotate-45 scale-110"
                  )}
                >
                  {isExpanded ? (
                    <X className="h-6 w-6 text-primary-foreground" />
                  ) : (
                    <Plus className="h-6 w-6 text-primary-foreground" />
                  )}
                </button>
              </div>
            );
          }

          const Icon = tab.icon!;
          const active = isActive(tab.path);

          return (
            <button
              key={tab.id}
              onClick={() => tab.id === "more" ? onMoreClick?.() : navigate(tab.path)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all duration-200",
                "active:scale-95",
                active && "text-primary"
              )}
            >
              <div
                className={cn(
                  "relative",
                  active && "animate-pulse-glow"
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 transition-all",
                    active && "drop-shadow-[0_0_8px_hsl(var(--primary))]"
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
    </>
  );
}
