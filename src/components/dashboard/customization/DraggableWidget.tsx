import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface DraggableWidgetProps {
  id: string;
  children: ReactNode;
  isEditMode?: boolean;
  row?: number;
  col?: number;
  rowSpan?: number;
  colSpan?: number;
}

export function DraggableWidget({
  id,
  children,
  isEditMode,
  row,
  col,
  rowSpan = 1,
  colSpan = 1,
}: DraggableWidgetProps) {
  const isMobile = useIsMobile();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      disabled: !isEditMode,
      data: { row, col, rowSpan, colSpan },
    });

  // On mobile, don't set any grid positioning - let widgets flow naturally
  // On tablet/desktop, use full grid positioning
  const style: React.CSSProperties = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    ...(isMobile
      ? {} // No grid constraints on mobile - widgets stack vertically in DOM order
      : {
          gridRowStart: row !== undefined ? row + 1 : undefined,
          gridRowEnd: row !== undefined ? row + 1 + rowSpan : undefined,
          gridColumnStart: col !== undefined ? col + 1 : undefined,
          gridColumnEnd: col !== undefined ? col + 1 + colSpan : undefined,
        }),
    // Smooth spring-like animation on drop
    transition: isDragging 
      ? undefined 
      : "transform 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28), opacity 0.2s ease-out",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "will-change-transform",
        isDragging && "opacity-80 z-50 shadow-2xl scale-[1.02]",
        isEditMode && "touch-none cursor-grab active:cursor-grabbing"
      )}
      {...(isEditMode ? { ...attributes, ...listeners } : {})}
    >
      {children}
    </div>
  );
}
