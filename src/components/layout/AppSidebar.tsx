import { NavLink, useLocation } from "react-router-dom";
import { useAppModules } from '@/hooks/useAppModules';
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
import { sections, isItemVisible, isSectionVisible, isNavItemActive, type NavItem as Item } from "./navConfig";


function SidebarNavItem({ item, isActive, unreadCount }: { item: Item; isActive: boolean; unreadCount: number }) {
  const Icon = item.icon;
  // Keep a collapsed group open when it contains the current page.
  const sectionOpen = (idx: number, items: Item[]) =>
    openSections[idx] ?? items.some((i) => isActive(i.href));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
        <NavLink to={item.href} end>
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
  const modules=useAppModules();
  const { pathname, search } = useLocation();
  const { isAdmin, isManager, isAccounting } = useUserRole();
  const { data: unreadCount = 0 } = useTotalUnreadCount();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({});

  const isActive = (href: string) => isNavItemActive(href, pathname, search);

  // Keep a collapsed group open when it contains the current page.
  const sectionOpen = (idx: number, items: Item[]) =>
    openSections[idx] ?? items.some((i) => isActive(i.href));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Spacer under the fixed top bar (which holds the logo) so menu items never slide beneath it. */}
      <SidebarHeader className="h-12 shrink-0 p-0 border-b border-sidebar-border" aria-hidden />
      <SidebarContent>
        {sections.map((section, idx) => {
          if (!isSectionVisible(section, isAdmin, isManager, isAccounting)) return null;


          const visibleItems = section.items.filter((i) => isItemVisible(i, isAdmin, isManager, isAccounting) && modules.visible(i.href));
          if (visibleItems.length === 0) return null;

          if (section.collapsible) {
            return (
              <Collapsible
                key={idx}
                open={sectionOpen(idx, visibleItems)}
                onOpenChange={(v) => setOpenSections((s) => ({ ...s, [idx]: v }))}
                className="group/collapsible"
              >
                <SidebarGroup>
                  <SidebarGroupLabel asChild>
                    <CollapsibleTrigger className="flex w-full items-center justify-between">
                      {section.title}
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          sectionOpen(idx, visibleItems) && "rotate-180",
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
