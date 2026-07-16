import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useUserRole } from "@/hooks/useUserRole";
import { useTotalUnreadCount } from "@/integrations/supabase/hooks/useConversations";
import { cn } from "@/lib/utils";
import { sections, isItemVisible, isSectionVisible, type NavItem as Item } from "./navConfig";


function SidebarNavItem({ item, isActive, unreadCount }: { item: Item; isActive: boolean; unreadCount: number }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
        <NavLink to={item.href} end={item.href === "/"}>
          <Icon className="h-4 w-4" />
          <span>{item.name}</span>
        </NavLink>
      </SidebarMenuButton>
      {item.badge === "unread" && unreadCount > 0 && (
        <SidebarMenuBadge className="bg-destructive text-destructive-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const { isAdmin, isManager } = useUserRole();
  const { data: unreadCount = 0 } = useTotalUnreadCount();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [adminOpen, setAdminOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-12 border-b border-sidebar-border" />
      <SidebarContent>
        {sections.map((section, idx) => {
          if (!isSectionVisible(section, isAdmin, isManager)) return null;


          const visibleItems = section.items.filter((i) => isItemVisible(i, isAdmin, isManager));
          if (visibleItems.length === 0) return null;

          if (section.collapsible) {
            return (
              <Collapsible
                key={idx}
                open={adminOpen}
                onOpenChange={setAdminOpen}
                className="group/collapsible"
              >
                <SidebarGroup>
                  <SidebarGroupLabel asChild>
                    <CollapsibleTrigger className="flex w-full items-center justify-between">
                      {section.title}
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          adminOpen && "rotate-180",
                        )}
                      />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {visibleItems.map((item) => (
                          <SidebarNavItem
                            key={item.href}
                            item={item}
                            isActive={isActive(item.href)}
                            unreadCount={unreadCount}
                          />
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          }

          return (
            <SidebarGroup key={idx}>
              {section.title && <SidebarGroupLabel>{section.title}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarNavItem
                      key={item.href}
                      item={item}
                      isActive={isActive(item.href)}
                      unreadCount={unreadCount}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
