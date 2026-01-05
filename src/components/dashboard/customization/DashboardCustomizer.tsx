import { useState, ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Plus, Palette, LayoutGrid } from "lucide-react";
import { WidgetLibrary } from "./WidgetLibrary";
import { DashboardThemeEditor } from "./DashboardThemeEditor";
import { ResetConfirmDialog } from "./ResetConfirmDialog";
import { DashboardLayout, DashboardWidget, DashboardTheme, LayoutWidget } from "../widgets/types";
import { WIDGET_REGISTRY } from "../widgets/registry";
import { cn } from "@/lib/utils";

interface DashboardCustomizerProps {
  isEditMode: boolean;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  theme: DashboardTheme;
  onLayoutChange: (layout: DashboardLayout) => void;
  onWidgetsChange: (widgets: DashboardWidget[]) => void;
  onThemeChange: (theme: DashboardTheme) => void;
  onReset: () => void;
  isResetting?: boolean;
  children: ReactNode;
}

export function DashboardCustomizer({
  isEditMode,
  layout,
  widgets,
  theme,
  onLayoutChange,
  onWidgetsChange,
  onThemeChange,
  onReset,
  isResetting,
  children,
}: DashboardCustomizerProps) {
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = layout.widgets.findIndex((w) => w.widgetId === active.id);
      const newIndex = layout.widgets.findIndex((w) => w.widgetId === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newWidgets = arrayMove(layout.widgets, oldIndex, newIndex);
        onLayoutChange({ ...layout, widgets: newWidgets });
      }
    }
  };

  const handleAddWidget = (widgetId: string) => {
    const registryEntry = WIDGET_REGISTRY[widgetId];
    if (!registryEntry) return;

    // Add to widgets array
    const newWidget: DashboardWidget = {
      id: widgetId,
      type: registryEntry.type,
      title: registryEntry.title,
      config: registryEntry.defaultConfig,
      visible: true,
    };
    onWidgetsChange([...widgets, newWidget]);

    // Add to layout
    const maxRow = layout.widgets.reduce((max, w) => Math.max(max, w.position.row + w.size.height), 0);
    const newLayoutWidget: LayoutWidget = {
      widgetId,
      position: { row: maxRow, col: 0 },
      size: registryEntry.defaultSize,
    };
    onLayoutChange({
      ...layout,
      widgets: [...layout.widgets, newLayoutWidget],
    });
  };

  const handleRemoveWidget = (widgetId: string) => {
    onWidgetsChange(widgets.filter((w) => w.id !== widgetId));
    onLayoutChange({
      ...layout,
      widgets: layout.widgets.filter((w) => w.widgetId !== widgetId),
    });
  };

  const handleResetConfirm = () => {
    onReset();
    setShowResetDialog(false);
  };

  const widgetIds = layout.widgets.map((w) => w.widgetId);

  if (!isEditMode) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Edit Mode Toolbar */}
      <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Edit Mode</span>
          <span className="text-xs text-muted-foreground">
            Drag widgets to rearrange
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowThemeEditor(true)}
            className="gap-2"
          >
            <Palette className="h-4 w-4" />
            Theme
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWidgetLibrary(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Widget
          </Button>
        </div>
      </div>

      {/* Main Content with Drag Context */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
          <div
            className={cn(
              "transition-all duration-200",
              showWidgetLibrary && "mr-80",
              showThemeEditor && "ml-80"
            )}
          >
            {children}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId && (
            <div className="bg-background/80 backdrop-blur border rounded-lg p-4 shadow-lg">
              <p className="font-medium text-sm">
                {WIDGET_REGISTRY[activeId]?.title || activeId}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Widget Library Sidebar */}
      <WidgetLibrary
        isOpen={showWidgetLibrary}
        onClose={() => setShowWidgetLibrary(false)}
        activeWidgets={widgets}
        onAddWidget={handleAddWidget}
      />

      {/* Theme Editor Sidebar */}
      <DashboardThemeEditor
        isOpen={showThemeEditor}
        onClose={() => setShowThemeEditor(false)}
        theme={theme}
        onChange={onThemeChange}
      />

      {/* Reset Confirmation Dialog */}
      <ResetConfirmDialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleResetConfirm}
        isLoading={isResetting}
      />
    </div>
  );
}
