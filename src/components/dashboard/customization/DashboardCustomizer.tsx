import { useState, ReactNode } from "react";
import {
  DndContext,
  pointerWithin,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Palette, LayoutGrid, Circle } from "lucide-react";
import { WidgetLibrary } from "./WidgetLibrary";
import { DashboardThemeEditor } from "./DashboardThemeEditor";
import { ResetConfirmDialog } from "./ResetConfirmDialog";
import {
  DashboardLayout,
  DashboardWidget,
  DashboardTheme,
  LayoutWidget,
} from "../widgets/types";
import { WIDGET_REGISTRY } from "../widgets/registry";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

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
  hasUnsavedChanges?: boolean;
  children: ReactNode;
}

// Haptic feedback helper
const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Medium) => {
  try {
    await Haptics.impact({ style });
  } catch {
    // Haptics not available (web browser)
  }
};

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
  hasUnsavedChanges,
  children,
}: DashboardCustomizerProps) {
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const isMobile = useIsMobile();

  // Close one panel when opening the other
  const handleOpenThemeEditor = () => {
    setShowWidgetLibrary(false);
    setShowThemeEditor(true);
  };

  const handleOpenWidgetLibrary = () => {
    setShowThemeEditor(false);
    setShowWidgetLibrary(true);
  };
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Touch-optimized sensors for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // Press and hold to start drag
        tolerance: 5, // Allow slight movement before canceling
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    triggerHaptic(ImpactStyle.Medium);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Get the drop zone data (row, col) from the droppable (0-indexed)
    const dropData = over.data.current as
      | { row?: number; col?: number }
      | undefined;
    if (!dropData || dropData.row === undefined || dropData.col === undefined)
      return;

    const widgetId = active.id as string;
    const widgetIndex = layout.widgets.findIndex(
      (w) => w.widgetId === widgetId
    );
    if (widgetIndex === -1) return;

    const widget = layout.widgets[widgetIndex];
    const newRow = dropData.row;
    // On mobile, always use column 0 (1-column stack)
    const newCol = isMobile ? 0 : dropData.col;

    // Check bounds - ensure widget fits in grid (desktop only)
    // Skip bounds check on mobile since we force col=0 and treat as 1-column stack
    if (!isMobile) {
      const maxCols = 4;
      if (newCol + widget.size.width > maxCols) return;
    }

    // Update widget position (0-indexed)
    let updatedWidgets = layout.widgets.map((w) =>
      w.widgetId === widgetId
        ? { ...w, position: { row: newRow, col: newCol } }
        : w
    );

    // On mobile, sort widgets by row and normalize to sequential positions
    if (isMobile) {
      updatedWidgets = [...updatedWidgets]
        .sort((a, b) => a.position.row - b.position.row)
        .map((w, index) => ({
          ...w,
          position: { row: index, col: 0 },
        }));
    }

    triggerHaptic(ImpactStyle.Light);
    onLayoutChange({ ...layout, widgets: updatedWidgets });
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

    // Add to layout - on mobile, use sequential row based on widget count
    const maxRow = isMobile 
      ? layout.widgets.length 
      : layout.widgets.reduce(
          (max, w) => Math.max(max, w.position.row + w.size.height),
          0
        );
    const newLayoutWidget: LayoutWidget = {
      widgetId,
      position: { row: maxRow, col: 0 },
      size: registryEntry.defaultSize,
    };
    onLayoutChange({
      ...layout,
      widgets: [...layout.widgets, newLayoutWidget],
    });
    
    triggerHaptic(ImpactStyle.Light);
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

  if (!isEditMode) {
    return <>{children}</>;
  }

  const sidebarOpen = showWidgetLibrary || showThemeEditor;

  return (
    <div className="relative">
      {/* Edit Mode Toolbar - Mobile optimized */}
      <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Edit Mode</span>
          {hasUnsavedChanges ? (
            <Badge variant="secondary" className="text-xs gap-1">
              <Circle className="h-2 w-2 fill-orange-500 text-orange-500" />
              <span className="hidden sm:inline">Unsaved changes</span>
              <span className="sm:hidden">Unsaved</span>
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Drag widgets to rearrange
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenThemeEditor}
            className="gap-1.5 h-9 text-sm"
          >
            <Palette className="h-4 w-4 shrink-0" />
            <span className="truncate">Theme</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenWidgetLibrary}
            className="gap-1.5 h-9 text-sm"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">Add Widget</span>
          </Button>
        </div>
      </div>

      {/* Main Content with Drag Context */}
      <DndContext
        sensors={sensors}
        collisionDetection={isMobile ? closestCenter : pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className={cn(
            "transition-all duration-200",
            // On mobile, sidebar overlays content; on desktop, content shifts
            sidebarOpen && !isMobile && "mr-80"
          )}
        >
          {children}
        </div>

        <DragOverlay>
          {activeId && (
            <div className="bg-background/90 backdrop-blur-sm border-2 border-primary/50 rounded-lg p-4 shadow-2xl scale-105 transition-transform">
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
