import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  ClipboardList, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentVendor } from "@/integrations/supabase/hooks/useVendorPortal";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile, useIsWideTablet } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const navItems = [
  { href: "/vendor", label: "Dashboard", icon: Home },
  { href: "/vendor/pos", label: "My POs", icon: ClipboardList },
  { href: "/vendor/bills", label: "My Bills", icon: FileText },
  { href: "/vendor/settings", label: "Settings", icon: Settings },
];

interface VendorPortalLayoutProps {
  children: ReactNode;
}

export function VendorPortalLayout({ children }: VendorPortalLayoutProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const { data: vendor } = useCurrentVendor();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const isMobile = useIsMobile();
  const isWideTablet = useIsWideTablet();

  // On tablet, default to collapsed sidebar for more content space
  const isCollapsed = isWideTablet ? sidebarCollapsed : false;
  const sidebarWidth = isCollapsed ? "w-16" : "w-64";
  const mainMargin = isCollapsed ? "md:ml-16" : "md:ml-64";

  const NavContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className={cn("p-4 border-b", collapsed && "px-2 py-4")}>
        {!collapsed ? (
          <>
            <h2 className="font-semibold text-lg">Vendor Portal</h2>
            {vendor && (
              <p className="text-sm text-muted-foreground truncate">
                {vendor.name}
              </p>
            )}
          </>
        ) : (
          <div className="flex justify-center">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-semibold text-sm">
                {vendor?.name?.charAt(0) || "V"}
              </span>
            </div>
          </div>
        )}
      </div>
      
      <nav className={cn("flex-1 p-4 space-y-1", collapsed && "px-2")}>
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== "/vendor" && location.pathname.startsWith(item.href));
            const Icon = item.icon;
            
            const linkContent = (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md text-sm font-medium transition-colors min-h-[44px]",
                  collapsed ? "justify-center px-2 py-3" : "px-3 py-2",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </TooltipProvider>
      </nav>
      
      <div className={cn("p-4 border-t", collapsed && "px-2")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="w-full min-h-[44px]"
                onClick={signOut}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign Out</TooltipContent>
          </Tooltip>
        ) : (
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 min-h-[44px]"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Desktop/Tablet Sidebar */}
        {!isMobile && (
          <aside className={cn(
            "fixed inset-y-0 left-0 flex flex-col border-r bg-card transition-all duration-300 z-30",
            sidebarWidth
          )}>
            <NavContent collapsed={isCollapsed} />
            
            {/* Collapse toggle for tablets */}
            {isWideTablet && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-20 h-6 w-6 rounded-full border bg-card shadow-md"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronLeft className="h-3 w-3" />
                )}
              </Button>
            )}
          </aside>
        )}
        
        {/* Mobile Header */}
        {isMobile && (
          <header className="sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-card">
            <h2 className="font-semibold">Vendor Portal</h2>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <NavContent />
              </SheetContent>
            </Sheet>
          </header>
        )}
        
        {/* Main Content */}
        <main className={cn(
          "min-h-screen transition-all duration-300",
          !isMobile && mainMargin
        )}>
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
