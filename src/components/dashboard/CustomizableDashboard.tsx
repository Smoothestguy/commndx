import { useState, useMemo, useEffect, useRef } from "react";
import { DashboardCustomizer, EditModeToggle, DraggableWidget } from "./customization";
import { UnsavedChangesDialog } from "./customization/UnsavedChangesDialog";
import {
  WidgetContainer,
  StatWidget,
  ChartWidget,
  ActivityWidget,
  QuickActionsWidget,
  WIDGET_REGISTRY,
} from "./widgets";
import { DashboardWidget, DashboardLayout, DashboardTheme, LayoutWidget } from "./widgets/types";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useUserRole } from "@/hooks/useUserRole";
import { WelcomeBanner } from "./WelcomeBanner";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CustomizableDashboardProps {
  children?: React.ReactNode;
}

export function CustomizableDashboard({ children }: CustomizableDashboardProps) {
  const { isAdmin, isManager } = useUserRole();
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

  // Draft state for local editing
  const [draftLayout, setDraftLayout] = useState<DashboardLayout>(activeLayout);
  const [draftWidgets, setDraftWidgets] = useState<DashboardWidget[]>(activeWidgets);
  const [draftTheme, setDraftTheme] = useState<DashboardTheme>(activeTheme);

  const canCustomize = isAdmin || isManager;

  // Track previous edit mode state to detect transitions
  const prevIsEditModeRef = useRef(isEditMode);

  // Sync draft with saved when entering edit mode or when saved values change while not editing
  useEffect(() => {
    const wasEditMode = prevIsEditModeRef.current;
    prevIsEditModeRef.current = isEditMode;

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
  }, [isEditMode, activeLayout, activeWidgets, activeTheme]);

  // Track unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!isEditMode) return false;
    return (
      JSON.stringify(draftLayout) !== JSON.stringify(activeLayout) ||
      JSON.stringify(draftWidgets) !== JSON.stringify(activeWidgets) ||
      JSON.stringify(draftTheme) !== JSON.stringify(activeTheme)
    );
  }, [isEditMode, draftLayout, draftWidgets, draftTheme, activeLayout, activeWidgets, activeTheme]);

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

  const renderWidget = (layoutWidget: LayoutWidget) => {
    const widget = draftWidgets.find((w) => w.id === layoutWidget.widgetId);
    if (!widget || !widget.visible) return null;

    const registryEntry = WIDGET_REGISTRY[widget.id];
    if (!registryEntry) return null;

    const Icon = registryEntry.icon;

    const widgetContent = () => {
      switch (widget.type) {
        case "welcome":
          return <WelcomeBanner />;
        case "stat":
          return <StatWidget widget={widget} theme={draftTheme} isEditMode={isEditMode} />;
        case "chart":
          return <ChartWidget widget={widget} theme={draftTheme} isEditMode={isEditMode} />;
        case "activity":
          return <ActivityWidget widget={widget} theme={draftTheme} isEditMode={isEditMode} />;
        case "quick-actions":
          return <QuickActionsWidget widget={widget} theme={draftTheme} isEditMode={isEditMode} />;
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
        <DraggableWidget key={widget.id} id={widget.id} isEditMode={isEditMode}>
          <div className={cn(isEditMode && "ring-2 ring-primary/20 ring-dashed rounded-lg")}>
            {widgetContent()}
          </div>
        </DraggableWidget>
      );
    }

    return (
      <DraggableWidget key={widget.id} id={widget.id} isEditMode={isEditMode}>
        <WidgetContainer
          title={widget.title}
          icon={<Icon className="h-4 w-4" />}
          isEditMode={isEditMode}
          theme={draftTheme}
          onRemove={() => handleRemoveWidget(widget.id)}
        >
          {widgetContent()}
        </WidgetContainer>
      </DraggableWidget>
    );
  };

  // Calculate grid spans for widgets
  const getGridSpanClass = (size: { width: number; height: number }) => {
    const colSpan = {
      1: "col-span-1",
      2: "col-span-2 sm:col-span-1 lg:col-span-2",
      3: "col-span-2 lg:col-span-3",
      4: "col-span-2 lg:col-span-4",
    }[size.width] || "col-span-1";

    const rowSpan = {
      1: "",
      2: "row-span-2",
      3: "row-span-3",
    }[size.height] || "";

    return cn(colSpan, rowSpan);
  };

  // Show default dashboard content if not customizable or loading
  if (!canCustomize || configLoading) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Edit Mode Toggle in Actions Area */}
      <div className="flex justify-end mb-4">
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
      </div>

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
        <div
          className="grid gap-4 grid-cols-2 lg:grid-cols-4"
          style={{
            fontFamily: draftTheme.fontFamily,
          }}
        >
          {draftLayout.widgets.map((layoutWidget) => (
            <div key={layoutWidget.widgetId} className={getGridSpanClass(layoutWidget.size)}>
              {renderWidget(layoutWidget)}
            </div>
          ))}
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
