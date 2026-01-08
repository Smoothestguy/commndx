import { useDraggable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";

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
  const isTablet = useIsTablet();
  const isMobileSortable = isMobile && isEditMode;
  // On tablet (2-col grid), disable explicit grid positioning to let widgets flow naturally
  const useFlowLayout = isMobile || isTablet;

  // Use sortable for mobile edit mode (vertical list reordering)
  const sortable = useSortable({
    id,
    disabled: !isMobileSortable,
  });

  // Use draggable for desktop/tablet edit mode (grid positioning)
  const draggable = useDraggable({
    id,
    disabled: !isEditMode || isMobile,
    data: { row, col, rowSpan, colSpan },
  });

  // Choose which hook's values to use
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = isMobileSortable ? sortable : draggable;

  // Get transition from sortable (draggable doesn't have it)
  const transition = isMobileSortable ? sortable.transition : undefined;

  // On mobile/tablet, widgets flow naturally (no explicit grid positioning)
  // On desktop, use full 4-column grid positioning
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? (isDragging 
      ? undefined 
      : "transform 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28), opacity 0.2s ease-out"),
    ...(useFlowLayout
      ? {} // No grid constraints - widgets stack in DOM order
      : {
          gridRowStart: row !== undefined ? row + 1 : undefined,
          gridRowEnd: row !== undefined ? row + 1 + rowSpan : undefined,
          gridColumnStart: col !== undefined ? col + 1 : undefined,
          gridColumnEnd: col !== undefined ? col + 1 + colSpan : undefined,
        }),
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
