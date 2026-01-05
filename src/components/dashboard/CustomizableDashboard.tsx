import { useState } from "react";
import { DashboardCustomizer, EditModeToggle, DraggableWidget } from "./customization";
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
import { RecentActivity } from "./RecentActivity";
import { cn } from "@/lib/utils";

interface CustomizableDashboardProps {
  children?: React.ReactNode;
}

export function CustomizableDashboard({ children }: CustomizableDashboardProps) {
  const { isAdmin, isManager } = useUserRole();
  const {
    activeLayout,
    activeWidgets,
    activeTheme,
    updateConfig,
    resetToDefault,
    isResetting,
    hasCustomConfig,
    isLoading: configLoading,
  } = useDashboardConfig();

  const [isEditMode, setIsEditMode] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const canCustomize = isAdmin || isManager;

  const handleLayoutChange = (layout: DashboardLayout) => {
    updateConfig({ layout });
  };

  const handleWidgetsChange = (widgets: DashboardWidget[]) => {
    updateConfig({ widgets });
  };

  const handleThemeChange = (theme: DashboardTheme) => {
    updateConfig({ theme });
  };

  const handleRemoveWidget = (widgetId: string) => {
    const newWidgets = activeWidgets.filter((w) => w.id !== widgetId);
    const newLayout = {
      ...activeLayout,
      widgets: activeLayout.widgets.filter((w) => w.widgetId !== widgetId),
    };
    updateConfig({ widgets: newWidgets, layout: newLayout });
  };

  const handleReset = () => {
    resetToDefault();
    setShowResetConfirm(false);
    setIsEditMode(false);
  };

  const renderWidget = (layoutWidget: LayoutWidget) => {
    const widget = activeWidgets.find((w) => w.id === layoutWidget.widgetId);
    if (!widget || !widget.visible) return null;

    const registryEntry = WIDGET_REGISTRY[widget.id];
    if (!registryEntry) return null;

    const Icon = registryEntry.icon;

    const widgetContent = () => {
      switch (widget.type) {
        case "welcome":
          return <WelcomeBanner />;
        case "stat":
          return <StatWidget widget={widget} theme={activeTheme} isEditMode={isEditMode} />;
        case "chart":
          return <ChartWidget widget={widget} theme={activeTheme} isEditMode={isEditMode} />;
        case "activity":
          return <ActivityWidget widget={widget} theme={activeTheme} isEditMode={isEditMode} />;
        case "quick-actions":
          return <QuickActionsWidget widget={widget} theme={activeTheme} isEditMode={isEditMode} />;
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
          theme={activeTheme}
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
          onToggle={() => setIsEditMode(!isEditMode)}
          onReset={() => setShowResetConfirm(true)}
          hasCustomConfig={hasCustomConfig}
        />
      </div>

      {/* Customizable Dashboard Content */}
      <DashboardCustomizer
        isEditMode={isEditMode}
        layout={activeLayout}
        widgets={activeWidgets}
        theme={activeTheme}
        onLayoutChange={handleLayoutChange}
        onWidgetsChange={handleWidgetsChange}
        onThemeChange={handleThemeChange}
        onReset={handleReset}
        isResetting={isResetting}
      >
        <div
          className="grid gap-4 grid-cols-2 lg:grid-cols-4"
          style={{
            fontFamily: activeTheme.fontFamily,
          }}
        >
          {activeLayout.widgets.map((layoutWidget) => (
            <div key={layoutWidget.widgetId} className={getGridSpanClass(layoutWidget.size)}>
              {renderWidget(layoutWidget)}
            </div>
          ))}
        </div>
      </DashboardCustomizer>
    </>
  );
}
