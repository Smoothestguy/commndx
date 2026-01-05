import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardTheme } from "./types";

interface WidgetContainerProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  isEditMode?: boolean;
  theme?: DashboardTheme;
  onConfigure?: () => void;
  onRemove?: () => void;
  className?: string;
  noPadding?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

export function WidgetContainer({
  title,
  icon,
  children,
  isEditMode = false,
  theme,
  onConfigure,
  onRemove,
  className,
  noPadding = false,
  dragHandleProps,
}: WidgetContainerProps) {
  const borderRadiusClass = {
    none: "rounded-none",
    small: "rounded-sm",
    medium: "rounded-lg",
    large: "rounded-xl",
  }[theme?.borderRadius ?? "medium"];

  const fontSizeClass = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg",
  }[theme?.fontSize ?? "medium"];

  const spacingClass = {
    compact: "p-3",
    normal: "p-4",
    relaxed: "p-6",
  }[theme?.spacing ?? "normal"];

  return (
    <Card
      className={cn(
        "relative transition-all duration-200",
        borderRadiusClass,
        isEditMode && "ring-2 ring-primary/20 ring-dashed",
        className
      )}
      style={{
        backgroundColor: theme?.cardBackground,
        opacity: theme?.cardOpacity ? theme.cardOpacity / 100 : 1,
      }}
    >
      {isEditMode && (
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          {onConfigure && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onConfigure}
            >
              <Settings className="h-3 w-3" />
            </Button>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
              onClick={onRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
      
      <CardHeader className={cn("pb-2", isEditMode && "cursor-move", spacingClass)}>
        <div className="flex items-center gap-2">
          {isEditMode && (
            <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <CardTitle className={cn(fontSizeClass)}>{title}</CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className={cn(noPadding ? "p-0" : spacingClass, "pt-0")}>
        {children}
      </CardContent>
    </Card>
  );
}
