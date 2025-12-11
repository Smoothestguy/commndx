import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  ClipboardList, 
  FileText, 
  Settings, 
  LogOut,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentVendor } from "@/integrations/supabase/hooks/useVendorPortal";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/vendor", label: "Dashboard", icon: Home },
  { href: "/vendor/pos", label: "My POs", icon: ClipboardList },
  { href: "/vendor/bills", label: "My Bills", icon: FileText },
];

interface VendorPortalLayoutProps {
  children: ReactNode;
}

export function VendorPortalLayout({ children }: VendorPortalLayoutProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const { data: vendor } = useCurrentVendor();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Vendor Portal</h2>
        {vendor && (
          <p className="text-sm text-muted-foreground">
            {vendor.name}
          </p>
        )}
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== "/vendor" && location.pathname.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-64 md:flex-col border-r bg-card">
        <NavContent />
      </aside>
      
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-card">
        <h2 className="font-semibold">Vendor Portal</h2>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <NavContent />
          </SheetContent>
        </Sheet>
      </header>
      
      {/* Main Content */}
      <main className="md:ml-64 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
