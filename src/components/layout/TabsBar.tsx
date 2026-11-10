import { X, Home, Users, FolderKanban, MapPin, Clock, Tent, BarChart3, Package, FileText, UserPlus, LayoutGrid, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppTabs, HOME_KEY } from "@/hooks/useAppTabs";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";

const ICONS: [RegExp, LucideIcon][] = [
  [/^\/$/, Home],
  [/^\/personnel|^\/staffing|^\/workforce/, Users],
  [/^\/projects?/, FolderKanban],
  [/^\/locations?/, MapPin],
  [/attendance|time-?tracking|timesheet/, Clock],
  [/^\/event/, Tent],
  [/report/, BarChart3],
  [/asset/, Package],
  [/applicant|application/, UserPlus],
  [/invoice|estimate|order|bill/, FileText],
];
const iconFor = (key: string) => ICONS.find(([re]) => re.test(key))?.[1] ?? LayoutGrid;

/** Browser-style workspace tabs; horizontal scroll strip on phones. */
export function TabsBar() {
  const { tabs, activeKey, activateTab, closeTab, closeOthers, closeAll } = useAppTabs();
  if (tabs.length <= 1 && activeKey === HOME_KEY) return null;

  return (
    <div className="flex items-stretch h-9 bg-muted/40 border-b border-border overflow-x-auto no-scrollbar shrink-0" role="tablist" aria-label="Open screens">
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        const Icon = iconFor(tab.key);
        const pinned = tab.key === HOME_KEY;
        return (
          <ContextMenu key={tab.key}>
            <ContextMenuTrigger asChild>
              <div
                role="tab"
                aria-label={tab.label}
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => activateTab(tab.key)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activateTab(tab.key); } }}
                onAuxClick={(e) => { if (e.button === 1 && !pinned) { e.preventDefault(); closeTab(tab.key); } }}
                className={cn(
                  "group flex items-center gap-1.5 px-3 h-full text-xs border-r border-border cursor-pointer select-none max-w-[200px] whitespace-nowrap shrink-0",
                  isActive ? "bg-background text-foreground border-t-2 border-t-primary" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                )}
                title={tab.path}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
                {!pinned && (
                  <Button
                    variant="ghost" size="icon"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.key); }}
                    className={cn("h-5 w-5 rounded p-0.5 hover:bg-muted-foreground/20 opacity-60 group-hover:opacity-100", isActive && "opacity-100")}
                    aria-label={`Close ${tab.label}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {!pinned && <ContextMenuItem onSelect={() => closeTab(tab.key)}>Close tab</ContextMenuItem>}
              <ContextMenuItem onSelect={() => closeOthers(tab.key)}>Close others</ContextMenuItem>
              <ContextMenuItem onSelect={() => closeAll()}>Close all tabs</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
      <div className="flex-1" />
      {tabs.length > 2 && (
        <Button variant="ghost" size="sm" className="h-full rounded-none text-xs text-muted-foreground hover:text-foreground hidden md:inline-flex" onClick={() => closeAll()}>
          Close all
        </Button>
      )}
    </div>
  );
}
