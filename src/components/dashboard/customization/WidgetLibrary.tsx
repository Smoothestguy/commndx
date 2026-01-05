import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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

  const filteredRegistry = Object.entries(WIDGET_REGISTRY).filter(([id, widget]) =>
    widget.title.toLowerCase().includes(search.toLowerCase()) ||
    widget.description.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Add Widgets</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search widgets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Widget List */}
      <ScrollArea className="flex-1">
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
                    "flex items-center gap-3 p-3 rounded-lg border",
                    isActive ? "bg-muted/50 border-muted" : "hover:bg-muted/30 cursor-pointer"
                  )}
                  onClick={() => !isActive && onAddWidget(id)}
                >
                  <div className="p-2 rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{widget.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {widget.description}
                    </p>
                  </div>
                  {!isActive && (
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                  {isActive && (
                    <span className="text-xs text-muted-foreground">Added</span>
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
                  <AccordionTrigger className="text-sm font-medium">
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
                              "flex items-center gap-3 p-2 rounded-md",
                              isActive
                                ? "bg-muted/50"
                                : "hover:bg-muted/30 cursor-pointer"
                            )}
                            onClick={() => !isActive && onAddWidget(widget.id)}
                          >
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1 text-sm">{widget.title}</span>
                            {!isActive && (
                              <Plus className="h-3 w-3 text-muted-foreground" />
                            )}
                            {isActive && (
                              <span className="text-xs text-muted-foreground">
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
      </ScrollArea>
    </div>
  );
}
