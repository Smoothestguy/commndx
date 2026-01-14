import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardTheme, WidgetSize } from "./types";
import { WidgetResizer } from "../customization/WidgetResizer";

interface WidgetContainerProps {
  title: string;
  titleLink?: string;
  icon?: ReactNode;
  children: ReactNode;
  isEditMode?: boolean;
  theme?: DashboardTheme;
  size?: WidgetSize;
  minSize?: WidgetSize;
  maxSize?: WidgetSize;
  onResize?: (size: WidgetSize) => void;
  onConfigure?: () => void;
  onRemove?: () => void;
  className?: string;
  noPadding?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

export function WidgetContainer({
  title,
  titleLink,
  icon,
  children,
  isEditMode = false,
  theme,
  size,
  minSize,
  maxSize,
  onResize,
  onConfigure,
  onRemove,
  className,
  noPadding = false,
  dragHandleProps,
}: WidgetContainerProps) {
  const isSpreadsheet = theme?.density === "spreadsheet";
  
  const borderRadiusClass = isSpreadsheet ? "rounded-none" : {
    none: "rounded-none",
    small: "rounded-sm",
    medium: "rounded-lg",
    large: "rounded-xl",
  }[theme?.borderRadius ?? "medium"];

  const fontSizeClass = isSpreadsheet ? "text-xs" : {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg",
  }[theme?.fontSize ?? "medium"];

  const spacingClass = isSpreadsheet ? "p-1.5" : {
    compact: "p-3",
    normal: "p-4",
    relaxed: "p-6",
  }[theme?.spacing ?? "normal"];

  // Spreadsheet mode: ultra-compact styling with no shadows
  if (isSpreadsheet) {
    return (
      <div
        className={cn(
          "relative bg-card border border-border",
          isEditMode && "ring-1 ring-primary/30 ring-dashed",
          className
        )}
        style={{
          backgroundColor: theme?.cardBackground,
          color: theme?.cardTextColor,
        }}
      >
        {isEditMode && (
          <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5 z-10">
            {size && onResize && (
              <WidgetResizer
                currentSize={size}
                minSize={minSize}
                maxSize={maxSize}
                onChange={onResize}
              />
            )}
            {onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        <div
          className={cn(
            "py-1 px-2 border-b border-border flex items-center gap-1.5",
            isEditMode && "cursor-move"
          )}
        >
          {isEditMode && (
            <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
          {icon && <span className="text-muted-foreground flex-shrink-0 [&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
          {titleLink && !isEditMode ? (
            <Link to={titleLink} className="text-xs font-semibold truncate min-w-0 hover:text-primary hover:underline">
              {title}
            </Link>
          ) : (
            <span className="text-xs font-semibold truncate min-w-0">{title}</span>
          )}
        </div>

        <div className={cn(noPadding ? "p-0" : "p-1.5")}>
          {children}
        </div>
      </div>
    );
  }

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
        color: theme?.cardTextColor,
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
          {size && onResize && (
            <WidgetResizer
              currentSize={size}
              minSize={minSize}
              maxSize={maxSize}
              onChange={onResize}
            />
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-background/80 shadow-sm hover:bg-destructive hover:text-destructive-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <CardHeader
        className={cn("pb-2", isEditMode && "cursor-move", spacingClass)}
      >
        <div className="flex items-center gap-2">
          {isEditMode && (
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          {icon && <span className="text-muted-foreground flex-shrink-0">{icon}</span>}
          {titleLink && !isEditMode ? (
            <Link to={titleLink} className={cn(fontSizeClass, "truncate min-w-0 font-semibold hover:text-primary hover:underline")}>
              {title}
            </Link>
          ) : (
            <CardTitle className={cn(fontSizeClass, "truncate min-w-0")}>{title}</CardTitle>
          )}
        </div>
      </CardHeader>

      <CardContent className={cn(noPadding ? "p-0" : spacingClass, "pt-0")}>
        {children}
      </CardContent>
    </Card>
  );
}
