import { useState } from "react";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Search, X } from "lucide-react";
import { WIDGET_REGISTRY, WIDGET_CATEGORIES, getWidgetsByCategory } from "../widgets/registry";
import { DashboardWidget } from "../widgets/types";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface WidgetLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  activeWidgets: DashboardWidget[];
  onAddWidget: (widgetId: string) => void;
}

export function WidgetLibrary({
  isOpen,
  onClose,
  activeWidgets,
  onAddWidget,
}: WidgetLibraryProps) {
  const [search, setSearch] = useState("");
  const activeWidgetIds = activeWidgets.map((w) => w.id);
  const isMobile = useIsMobile();

  const filteredRegistry = Object.entries(WIDGET_REGISTRY).filter(([id, widget]) =>
    widget.title.toLowerCase().includes(search.toLowerCase()) ||
    widget.description.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && (
        <div 
          className="fixed inset-0 bg-black/20 z-[199] animate-fade-in"
          onClick={onClose}
        />
      )}
      
      <div className={cn(
        "fixed bg-background shadow-lg z-[200] flex flex-col",
        // Bottom sheet on mobile, right sidebar on desktop
        "inset-x-0 bottom-0 rounded-t-xl max-h-[70vh] max-h-[70dvh] border-t",
        "sm:inset-x-auto sm:right-0 sm:top-14 sm:bottom-0 sm:w-80 sm:rounded-none sm:max-h-none sm:border-l sm:border-t-0",
        // Slide up on mobile, slide in from right on desktop
        "animate-slide-in-up sm:animate-slide-in-right"
      )}>
        {/* Drag handle for mobile bottom sheet */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between shrink-0 sticky top-0 bg-background z-10">
          <h3 className="font-semibold">Add Widgets</h3>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="h-10 w-10 sm:h-8 sm:w-8"
          >
            <X className="h-5 w-5 sm:h-4 sm:w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search widgets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 sm:h-9"
            />
          </div>
        </div>

        {/* Widget List - Scrollable area */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {search ? (
            // Show flat list when searching
            <div className="p-4 space-y-2">
              {filteredRegistry.map(([id, widget]) => {
                const isActive = activeWidgetIds.includes(id);
                const Icon = widget.icon;
                return (
                  <div
                    key={id}
                    className={cn(
                      "flex items-center gap-3 p-3 sm:p-2 rounded-lg border",
                      // Larger touch targets on mobile
                      "min-h-[64px] sm:min-h-0",
                      isActive 
                        ? "bg-muted/50 border-muted" 
                        : "hover:bg-muted/30 active:bg-muted/50 active:scale-[0.98] cursor-pointer transition-all"
                    )}
                    onClick={() => !isActive && onAddWidget(id)}
                  >
                    <div className="p-2 rounded-md bg-primary/10 shrink-0">
                      <Icon className="h-5 w-5 sm:h-4 sm:w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{widget.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {widget.description}
                      </p>
                    </div>
                    {!isActive && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-6 sm:w-6 shrink-0">
                        <Plus className="h-4 w-4 sm:h-3 sm:w-3" />
                      </Button>
                    )}
                    {isActive && (
                      <span className="text-xs text-muted-foreground shrink-0">Added</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // Show categorized list
            <Accordion type="multiple" defaultValue={["stats", "charts", "lists", "actions"]} className="p-4">
              {Object.entries(WIDGET_CATEGORIES).map(([categoryId, category]) => {
                const widgets = getWidgetsByCategory(categoryId as keyof typeof WIDGET_CATEGORIES);
                if (widgets.length === 0) return null;

                return (
                  <AccordionItem key={categoryId} value={categoryId}>
                    <AccordionTrigger className="text-sm font-medium py-3">
                      {category.label}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-2">
                        {widgets.map((widget) => {
                          const isActive = activeWidgetIds.includes(widget.id);
                          const Icon = widget.icon;
                          return (
                            <div
                              key={widget.id}
                              className={cn(
                                "flex items-center gap-3 p-3 sm:p-2 rounded-md",
                                // Larger touch targets on mobile
                                "min-h-[52px] sm:min-h-0",
                                isActive
                                  ? "bg-muted/50"
                                  : "hover:bg-muted/30 active:bg-muted/50 active:scale-[0.98] cursor-pointer transition-all"
                              )}
                              onClick={() => !isActive && onAddWidget(widget.id)}
                            >
                              <Icon className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                              <span className="flex-1 text-sm">{widget.title}</span>
                              {!isActive && (
                                <Plus className="h-4 w-4 sm:h-3 sm:w-3 text-muted-foreground shrink-0" />
                              )}
                              {isActive && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  Added
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>

        {/* Mobile close button at bottom */}
        {isMobile && (
          <div className="p-4 border-t shrink-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <Button 
              onClick={onClose} 
              className="w-full h-12"
              variant="secondary"
            >
              Close
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
