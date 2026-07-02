import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppTabs } from "@/hooks/useAppTabs";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function TabsBar() {
  const { tabs, activePath, activateTab, closeTab, closeOthers, closeAll } = useAppTabs();

  if (tabs.length === 0) return null;

  return (
    <div className="hidden md:flex items-stretch h-9 bg-muted/40 border-b border-border overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const isActive = tab.path === activePath;
        return (
          <ContextMenu key={tab.path}>
            <ContextMenuTrigger asChild>
              <div
                role="button"
                tabIndex={0}
                onClick={() => activateTab(tab.path)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    activateTab(tab.path);
                  }
                }}
                onAuxClick={(e) => {
                  // middle-click closes tab
                  if (e.button === 1) {
                    e.preventDefault();
                    closeTab(tab.path);
                  }
                }}
                className={cn(
                  "group flex items-center gap-2 px-3 h-full text-xs border-r border-border cursor-pointer select-none max-w-[220px] whitespace-nowrap",
                  isActive
                    ? "bg-background text-foreground border-t-2 border-t-primary -mt-px"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                )}
                title={tab.path}
              >
                <span className="truncate">{tab.label}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.path);
                  }}
                  className={cn(
                    "rounded p-0.5 hover:bg-muted-foreground/20 opacity-60 group-hover:opacity-100",
                    isActive && "opacity-100"
                  )}
                  aria-label={`Close ${tab.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => closeTab(tab.path)}>Close tab</ContextMenuItem>
              <ContextMenuItem onSelect={() => closeOthers(tab.path)}>Close others</ContextMenuItem>
              <ContextMenuItem onSelect={() => closeAll()}>Close all tabs</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
      <div className="flex-1" />
      {tabs.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-full rounded-none text-xs text-muted-foreground hover:text-foreground"
          onClick={() => closeAll()}
        >
          Close all
        </Button>
      )}
    </div>
  );
}
