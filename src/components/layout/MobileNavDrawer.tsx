import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ChevronDown, LogOut, User } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useTotalUnreadCount } from "@/integrations/supabase/hooks/useConversations";
import { sections, isItemVisible, isSectionVisible } from "./navConfig";
import logo from "@/assets/logo.png";

interface MobileNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNavDrawer({ open, onOpenChange }: MobileNavDrawerProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, isManager } = useUserRole();
  const { data: unreadCount = 0 } = useTotalUnreadCount();
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({});

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const close = () => onOpenChange(false);
  const go = (href: string) => {
    close();
    navigate(href);
  };

  const handleSignOut = async () => {
    close();
    await signOut();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[85vw] max-w-sm p-0 flex flex-col">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-left">
            <img src={logo} alt="Command X" className="h-7 w-auto" />
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <nav className="p-2">
            {sections.map((section, idx) => {
              if (!isSectionVisible(section, isAdmin, isManager)) return null;
              const visibleItems = section.items.filter((i) =>
                isItemVisible(i, isAdmin, isManager),
              );
              if (visibleItems.length === 0) return null;

              const renderItems = () =>
                visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      end={item.href === "/"}
                      onClick={close}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{item.name}</span>
                      {item.badge === "unread" && unreadCount > 0 && (
                        <Badge className="bg-destructive text-destructive-foreground h-5 px-1.5 text-[10px]">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Badge>
                      )}
                    </NavLink>
                  );
                });

              if (!section.title) {
                return (
                  <div key={idx} className="space-y-0.5 mb-2">
                    {renderItems()}
                  </div>
                );
              }

              if (section.collapsible) {
                const isOpen = openSections[idx] ?? section.defaultOpen ?? false;
                return (
                  <Collapsible
                    key={idx}
                    open={isOpen}
                    onOpenChange={(v) =>
                      setOpenSections((s) => ({ ...s, [idx]: v }))
                    }
                    className="mb-2"
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                      <span>{section.title}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-0.5 mt-1">
                      {renderItems()}
                    </CollapsibleContent>
                  </Collapsible>
                );
              }

              return (
                <div key={idx} className="mb-3">
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.title}
                  </div>
                  <div className="space-y-0.5">{renderItems()}</div>
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="border-t p-2 space-y-1 safe-area-bottom">
          {user && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span className="truncate">{user.email}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
