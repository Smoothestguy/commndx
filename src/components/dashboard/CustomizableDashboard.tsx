import { useState, useMemo, useEffect, useRef } from "react";
import {
  DashboardCustomizer,
  EditModeToggle,
  DraggableWidget,
} from "./customization";
import { UnsavedChangesDialog } from "./customization/UnsavedChangesDialog";
import { GridDropZone } from "./customization/GridDropZone";
import {
  WidgetContainer,
  StatWidget,
  ChartWidget,
  ActivityWidget,
  QuickActionsWidget,
  TableWidget,
  TrashWidget,
  WIDGET_REGISTRY,
} from "./widgets";
import {
  DashboardWidget,
  DashboardLayout,
  DashboardTheme,
  LayoutWidget,
} from "./widgets/types";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useUserRole } from "@/hooks/useUserRole";
import { WelcomeBanner } from "./WelcomeBanner";
import { DashboardLoadingSkeleton } from "./DashboardLoadingSkeleton";
import { cn } from "@/lib/utils";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { useDashboardDraft } from "@/contexts/DashboardDraftContext";
import { usePageHeaderActions } from "@/contexts/PageHeaderActionsContext";

interface CustomizableDashboardProps {
  children?: React.ReactNode;
}

export function CustomizableDashboard({
  children,
}: CustomizableDashboardProps) {
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const {
    activeLayout,
    activeWidgets,
    activeTheme,
    updateConfigAsync,
    isUpdating,
    resetToDefault,
    isResetting,
    hasCustomConfig,
    isLoading: configLoading,
  } = useDashboardConfig();

  const [isEditMode, setIsEditMode] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Draft state for local editing - initialized to empty, will be synced after load
  const [draftLayout, setDraftLayout] = useState<DashboardLayout | null>(null);
  const [draftWidgets, setDraftWidgets] = useState<DashboardWidget[] | null>(
    null
  );
  const [draftTheme, setDraftTheme] = useState<DashboardTheme | null>(null);

  const canCustomize = isAdmin || isManager;
  const draftContext = useDashboardDraft();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  
  // Get page header actions context - may not be available during SSR/initial render
  let pageHeaderActions: ReturnType<typeof usePageHeaderActions> | null = null;
  try {
    pageHeaderActions = usePageHeaderActions();
  } catch {
    // Context not available, will render inline
  }
  
  // Responsive column count based on screen size:
  // - Mobile: 1 column (stacked)
  // - Tablet: 2 columns
  // - Desktop: 4 columns
  const gridColumns = isMobile ? 1 : isTablet ? 2 : 4;

  // Track previous edit mode state to detect transitions
  const prevIsEditModeRef = useRef(isEditMode);

  // Track if we've initialized the draft state after config loaded
  const hasInitializedRef = useRef(false);

  // Initialize draft state once config has loaded, and sync when not in edit mode
  useEffect(() => {
    // Skip if still loading
    if (configLoading) return;

    const wasEditMode = prevIsEditModeRef.current;
    prevIsEditModeRef.current = isEditMode;

    // Initialize on first successful load
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setDraftLayout(activeLayout);
      setDraftWidgets(activeWidgets);
      setDraftTheme(activeTheme);
      return;
    }

    // Sync when ENTERING edit mode (false → true) to get latest saved values
    if (isEditMode && !wasEditMode) {
      setDraftLayout(activeLayout);
      setDraftWidgets(activeWidgets);
      setDraftTheme(activeTheme);
    }

    // Also sync when NOT in edit mode (to keep draft in sync with saved for next edit session)
    if (!isEditMode) {
      setDraftLayout(activeLayout);
      setDraftWidgets(activeWidgets);
      setDraftTheme(activeTheme);
    }
  }, [configLoading, isEditMode, activeLayout, activeWidgets, activeTheme]);

  // Sync draft state to context so BackgroundMediaLayer can access it
  useEffect(() => {
    if (draftContext) {
      draftContext.setDraftTheme(draftTheme);
      draftContext.setIsEditMode(isEditMode);
    }
  }, [draftTheme, isEditMode, draftContext]);



  const hasUnsavedChanges = useMemo(() => {
    if (!isEditMode) return false;
    return (
      JSON.stringify(draftLayout) !== JSON.stringify(activeLayout) ||
      JSON.stringify(draftWidgets) !== JSON.stringify(activeWidgets) ||
      JSON.stringify(draftTheme) !== JSON.stringify(activeTheme)
    );
  }, [
    isEditMode,
    draftLayout,
    draftWidgets,
    draftTheme,
    activeLayout,
    activeWidgets,
    activeTheme,
  ]);

  // Draft change handlers - update local state only
  const handleLayoutChange = (layout: DashboardLayout) => {
    setDraftLayout(layout);
  };

  const handleWidgetsChange = (widgets: DashboardWidget[]) => {
    setDraftWidgets(widgets);
  };

  const handleThemeChange = (theme: DashboardTheme) => {
    setDraftTheme(theme);
  };

  const handleRemoveWidget = (widgetId: string) => {
    if (!draftWidgets || !draftLayout) return;
    const newWidgets = draftWidgets.filter((w) => w.id !== widgetId);
    const newLayout = {
      ...draftLayout,
      widgets: draftLayout.widgets.filter((w) => w.widgetId !== widgetId),
    };
    setDraftWidgets(newWidgets);
    setDraftLayout(newLayout);
  };

  // Save changes to database
  const handleSave = async () => {
    if (!draftLayout || !draftWidgets || !draftTheme) return;
    try {
      await updateConfigAsync({
        layout: draftLayout,
        widgets: draftWidgets,
        theme: draftTheme,
      });
      toast.success("Dashboard saved");
    } catch (error) {
      // Error toast is handled in the hook
    }
  };

  // Revert to saved state
  const handleRevert = () => {
    setDraftLayout(activeLayout);
    setDraftWidgets(activeWidgets);
    setDraftTheme(activeTheme);
    toast.info("Changes reverted");
  };

  // Handle exit edit mode
  const handleExitEditMode = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      setIsEditMode(false);
    }
  };

  // Save and exit
  const handleSaveAndExit = async () => {
    await handleSave();
    setShowUnsavedDialog(false);
    setIsEditMode(false);
  };

  // Discard and exit
  const handleDiscardAndExit = () => {
    handleRevert();
    setShowUnsavedDialog(false);
    setIsEditMode(false);
  };

  const handleReset = () => {
    resetToDefault();
    setShowResetConfirm(false);
    setIsEditMode(false);
  };

  // Register the EditModeToggle in the page header
  useEffect(() => {
    if (!pageHeaderActions || !canCustomize) return;
    
    pageHeaderActions.setRightActions(
      <EditModeToggle
        isEditMode={isEditMode}
        onToggle={isEditMode ? handleExitEditMode : () => setIsEditMode(true)}
        onSave={handleSave}
        onRevert={handleRevert}
        onReset={() => setShowResetConfirm(true)}
        hasCustomConfig={hasCustomConfig}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isUpdating}
      />
    );
    
    return () => {
      pageHeaderActions.setRightActions(null);
    };
  }, [
    pageHeaderActions,
    canCustomize,
    isEditMode,
    hasCustomConfig,
    hasUnsavedChanges,
    isUpdating,
    showResetConfirm,
  ]);

  // Map font family keys to actual CSS font stacks
  const getFontFamily = (fontKey?: string): string | undefined => {
    const fontMap: Record<string, string> = {
      inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
      roboto: '"Roboto", ui-sans-serif, system-ui, sans-serif',
      poppins: '"Poppins", ui-sans-serif, system-ui, sans-serif',
      montserrat: '"Montserrat", ui-sans-serif, system-ui, sans-serif',
    };
    return fontKey ? fontMap[fontKey] : undefined;
  };

  // Handle widget resize
  const handleWidgetResize = (
    widgetId: string,
    newSize: { width: number; height: number }
  ) => {
    setDraftLayout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        widgets: prev.widgets.map((lw) =>
          lw.widgetId === widgetId ? { ...lw, size: newSize } : lw
        ),
      };
    });
  };

  const renderWidget = (layoutWidget: LayoutWidget) => {
    const widget = draftWidgets.find((w) => w.id === layoutWidget.widgetId);
    if (!widget || !widget.visible) return null;

    const registryEntry = WIDGET_REGISTRY[widget.id];
    if (!registryEntry) return null;

    const Icon = registryEntry.icon;

    const widgetContent = () => {
      switch (widget.type) {
        case "welcome":
          return <WelcomeBanner theme={draftTheme} />;
        case "stat":
          return (
            <StatWidget
              widget={widget}
              theme={draftTheme}
              isEditMode={isEditMode}
            />
          );
        case "chart":
          return (
            <ChartWidget
              widget={widget}
              theme={draftTheme}
              isEditMode={isEditMode}
            />
          );
        case "activity":
          return (
            <ActivityWidget
              widget={widget}
              theme={draftTheme}
              isEditMode={isEditMode}
            />
          );
        case "quick-actions":
          return (
            <QuickActionsWidget
              widget={widget}
              theme={draftTheme}
              isEditMode={isEditMode}
            />
          );
        case "table":
          return (
            <TableWidget
              widget={widget}
              theme={draftTheme}
              isEditMode={isEditMode}
            />
          );
        case "trash":
          return (
            <TrashWidget
              widget={widget}
              theme={draftTheme}
              isEditMode={isEditMode}
            />
          );
        default:
          return (
            <div className="text-muted-foreground text-sm">
              Widget type "{widget.type}" not implemented
            </div>
          );
      }
    };

    // Welcome banner renders without container
    if (widget.type === "welcome") {
      return (
        <DraggableWidget
          key={widget.id}
          id={widget.id}
          isEditMode={isEditMode}
          row={layoutWidget.position.row}
          col={layoutWidget.position.col}
          rowSpan={layoutWidget.size.height}
          colSpan={layoutWidget.size.width}
        >
          <div
            className={cn(
              isEditMode && "ring-2 ring-primary/20 ring-dashed rounded-lg"
            )}
          >
            {widgetContent()}
          </div>
        </DraggableWidget>
      );
    }

    // Stat widgets render without container in view mode (StatCard is already a card)
    if (widget.type === "stat" && !isEditMode) {
      return (
        <DraggableWidget
          key={widget.id}
          id={widget.id}
          isEditMode={isEditMode}
          row={layoutWidget.position.row}
          col={layoutWidget.position.col}
          rowSpan={layoutWidget.size.height}
          colSpan={layoutWidget.size.width}
        >
          {widgetContent()}
        </DraggableWidget>
      );
    }

    return (
      <DraggableWidget
        key={widget.id}
        id={widget.id}
        isEditMode={isEditMode}
        row={layoutWidget.position.row}
        col={layoutWidget.position.col}
        rowSpan={layoutWidget.size.height}
        colSpan={layoutWidget.size.width}
      >
        <WidgetContainer
          title={widget.title}
          titleLink={registryEntry.titleLink}
          icon={<Icon className="h-4 w-4" />}
          isEditMode={isEditMode}
          theme={draftTheme}
          size={layoutWidget.size}
          minSize={registryEntry.minSize}
          maxSize={registryEntry.maxSize}
          onResize={(newSize) => handleWidgetResize(widget.id, newSize)}
          onRemove={() => handleRemoveWidget(widget.id)}
        >
          {widgetContent()}
        </WidgetContainer>
      </DraggableWidget>
    );
  };

  // Calculate which cells are occupied by widgets (0-indexed)
  // Only mark cells as occupied if the widget will actually render
  const getOccupiedCells = useMemo(() => {
    const occupied = new Set<string>();
    if (!draftLayout || !draftWidgets) return occupied;
    for (const lw of draftLayout.widgets) {
      // Check if widget will actually render
      const widget = draftWidgets.find((w) => w.id === lw.widgetId);
      const registryEntry = widget ? WIDGET_REGISTRY[widget.id] : null;

      // Skip if widget won't render (no registry entry or not visible)
      if (!widget || !widget.visible || !registryEntry) continue;

      // On mobile, treat each widget as occupying exactly 1 row at column 0
      // (widgets stack vertically regardless of their desktop size)
      if (isMobile) {
        occupied.add(`${lw.position.row}-0`);
      } else {
        // Desktop: use actual widget size
        for (let r = lw.position.row; r < lw.position.row + lw.size.height; r++) {
          for (
            let c = lw.position.col;
            c < lw.position.col + lw.size.width;
            c++
          ) {
            occupied.add(`${r}-${c}`);
          }
        }
      }
    }
    return occupied;
  }, [draftLayout, draftWidgets, isMobile]);

  // Calculate the max row needed (0-indexed)
  const maxRow = useMemo(() => {
    if (!draftLayout) return 0;
    
    // On mobile, max row is based on widget count (sequential stacking)
    if (isMobile) {
      return isEditMode ? draftLayout.widgets.length + 2 : draftLayout.widgets.length;
    }
    
    // On desktop, calculate based on positions
    let max = 0;
    for (const lw of draftLayout.widgets) {
      max = Math.max(max, lw.position.row + lw.size.height);
    }
    // Add extra rows for dropping in edit mode
    return isEditMode ? max + 2 : max;
  }, [draftLayout, isEditMode, isMobile]);

  // Generate drop zones for empty cells (0-indexed positions, 1-indexed CSS Grid)
  const dropZones = useMemo(() => {
    if (!isEditMode) return [];
    const zones: { id: string; row: number; col: number }[] = [];
    for (let row = 0; row < maxRow; row++) {
      // On mobile, only create drop zones for column 0
      const colsToCheck = isMobile ? 1 : gridColumns;
      for (let col = 0; col < colsToCheck; col++) {
        if (!getOccupiedCells.has(`${row}-${col}`)) {
          // Store 0-indexed position but pass 1-indexed to CSS Grid
          zones.push({ id: `drop-${row}-${col}`, row, col });
        }
      }
    }
    return zones;
  }, [isEditMode, maxRow, getOccupiedCells, gridColumns, isMobile]);

  // On mobile, sort widgets by row so DOM order matches visual order
  const sortedLayoutWidgets = useMemo(() => {
    if (!draftLayout) return [];
    return isMobile
      ? [...draftLayout.widgets].sort((a, b) => a.position.row - b.position.row)
      : draftLayout.widgets;
  }, [draftLayout, isMobile]);

  // While role is resolving, avoid flashing fallback dashboard content
  if (roleLoading) {
    return <DashboardLoadingSkeleton />;
  }

  // Show default dashboard content if not customizable
  if (!canCustomize) {
    return <>{children}</>;
  }

  // Show loading skeleton while config loads or draft state hasn't been initialized
  if (configLoading || !draftLayout || !draftWidgets || !draftTheme) {
    return <DashboardLoadingSkeleton />;
  }

  // Background is now rendered via BackgroundMediaLayer in SidebarLayout

  return (
    <>
      {/* Customizable Dashboard Content */}
      <DashboardCustomizer
        isEditMode={isEditMode}
        layout={draftLayout}
        widgets={draftWidgets}
        theme={draftTheme}
        onLayoutChange={handleLayoutChange}
        onWidgetsChange={handleWidgetsChange}
        onThemeChange={handleThemeChange}
        onReset={handleReset}
        isResetting={isResetting}
        hasUnsavedChanges={hasUnsavedChanges}
      >
        <div className="relative min-h-[calc(100vh-200px)] z-[1]">
          {/* Mobile Edit Mode: Flex container for sortable list */}
          {isMobile && isEditMode ? (
            <div
              className={cn(
                "flex flex-col",
                {
                  "gap-2": draftTheme.spacing === "compact",
                  "gap-3": draftTheme.spacing === "normal" || !draftTheme.spacing,
                  "gap-4": draftTheme.spacing === "relaxed",
                }
              )}
              style={{ fontFamily: getFontFamily(draftTheme.fontFamily) }}
            >
              {/* No drop zones on mobile - widgets are sortable list items */}
              {sortedLayoutWidgets.map((layoutWidget) =>
                renderWidget(layoutWidget)
              )}
            </div>
          ) : (
            /* Desktop/Tablet and Mobile View Mode: Grid layout */
            <div
              className={cn(
                "grid relative",
                // Responsive columns
                "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
                {
                  // Spreadsheet mode: minimal gaps
                  "gap-1": draftTheme.density === "spreadsheet",
                  "gap-2 sm:gap-2": draftTheme.spacing === "compact" && draftTheme.density !== "spreadsheet",
                  "gap-3 sm:gap-4": (draftTheme.spacing === "normal" || !draftTheme.spacing) && draftTheme.density !== "spreadsheet",
                  "gap-4 sm:gap-6": draftTheme.spacing === "relaxed" && draftTheme.density !== "spreadsheet",
                }
              )}
              style={{
                fontFamily: getFontFamily(draftTheme.fontFamily),
                gridAutoRows: draftTheme.density === "spreadsheet" 
                  ? "minmax(50px, auto)" 
                  : isMobile ? "minmax(80px, auto)" : "minmax(100px, auto)",
              }}
            >
              {/* Drop zones for empty cells in edit mode (desktop/tablet only) */}
              {!isMobile && dropZones.map((zone) => (
                <GridDropZone
                  key={zone.id}
                  id={zone.id}
                  row={zone.row}
                  col={zone.col}
                  isEditMode={isEditMode}
                />
              ))}

              {/* Render widgets at their grid positions */}
              {sortedLayoutWidgets.map((layoutWidget) =>
                renderWidget(layoutWidget)
              )}
            </div>
          )}
        </div>
      </DashboardCustomizer>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onClose={() => setShowUnsavedDialog(false)}
        onSaveAndExit={handleSaveAndExit}
        onDiscardAndExit={handleDiscardAndExit}
        isSaving={isUpdating}
      />
    </>
  );
}
