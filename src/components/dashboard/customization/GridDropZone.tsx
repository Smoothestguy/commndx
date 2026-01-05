import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
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
        "min-h-[120px] flex items-center justify-center",
        "group",
        isOver
          ? "border-primary bg-primary/10"
          : "border-muted-foreground/30 hover:border-muted-foreground/50 bg-muted/5"
      )}
      style={{
        // Convert to 1-indexed for CSS Grid
        gridRowStart: row + 1,
        gridColumnStart: col + 1,
      }}
    >
      <div className={cn(
        "text-muted-foreground/40 transition-opacity",
        "opacity-0 group-hover:opacity-100",
        isOver && "opacity-100 text-primary"
      )}>
        <Plus className="h-6 w-6" />
      </div>
    </div>
  );
}
