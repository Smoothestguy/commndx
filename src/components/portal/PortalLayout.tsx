import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  Clock, 
  Briefcase, 
  Receipt, 
  Bell, 
  Settings, 
  LogOut,
  Menu,
  FileText,
  FolderOpen,
  Timer,
  Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentPersonnel, usePersonnelNotifications } from "@/integrations/supabase/hooks/usePortal";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";

const navItems = [
  { href: "/portal", label: "Dashboard", icon: Home },
  { href: "/portal/time-clock", label: "Time Clock", icon: Timer },
  { href: "/portal/hours", label: "My Hours", icon: Clock },
  { href: "/portal/projects", label: "My Projects", icon: Briefcase },
  { href: "/portal/assets", label: "My Assets", icon: Package },
  { href: "/portal/documents", label: "My Documents", icon: FolderOpen },
  { href: "/portal/reimbursements", label: "Reimbursements", icon: Receipt },
  { href: "/portal/tax-forms", label: "Tax Forms", icon: FileText },
  { href: "/portal/notifications", label: "Notifications", icon: Bell },
  { href: "/portal/settings", label: "Settings", icon: Settings },
];

interface PortalLayoutProps {
  children: ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const { data: personnel } = useCurrentPersonnel();
  const { data: notifications } = usePersonnelNotifications(personnel?.id);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          {personnel && (
            <PersonnelAvatar
              photoUrl={personnel.photo_url}
              firstName={personnel.first_name}
              lastName={personnel.last_name}
              size="md"
            />
          )}
          <div>
            <h2 className="font-semibold text-lg">Personnel Portal</h2>
            {personnel && (
              <p className="text-sm text-muted-foreground">
                {personnel.first_name} {personnel.last_name}
              </p>
            )}
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
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
              {item.href === "/portal/notifications" && unreadCount > 0 && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
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
        <h2 className="font-semibold">Personnel Portal</h2>
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
