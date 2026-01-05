import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      disabled: !isEditMode,
      data: { row, col, rowSpan, colSpan },
    });

  // Convert from 0-indexed positions to 1-indexed CSS Grid positions
  const style: React.CSSProperties = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    gridRowStart: row !== undefined ? row + 1 : undefined,
    gridRowEnd: row !== undefined ? row + 1 + rowSpan : undefined,
    gridColumnStart: col !== undefined ? col + 1 : undefined,
    gridColumnEnd: col !== undefined ? col + 1 + colSpan : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-shadow duration-200",
        isDragging && "opacity-70 z-50 shadow-2xl"
      )}
      {...(isEditMode ? { ...attributes, ...listeners } : {})}
    >
      {children}
    </div>
  );
}
