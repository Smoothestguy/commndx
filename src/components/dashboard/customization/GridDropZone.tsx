import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface GridDropZoneProps {
  id: string;
  row: number; // 0-indexed
  col: number; // 0-indexed
  isEditMode?: boolean;
}

export function GridDropZone({ id, row, col, isEditMode }: GridDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { row, col }, // Keep 0-indexed for data
  });

  if (!isEditMode) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-2 border-dashed rounded-lg transition-all duration-200",
        "min-h-[100px]",
        isOver
          ? "border-primary bg-primary/10"
          : "border-muted-foreground/20 hover:border-muted-foreground/40"
      )}
      style={{
        // Convert to 1-indexed for CSS Grid
        gridRowStart: row + 1,
        gridColumnStart: col + 1,
      }}
    />
  );
}
