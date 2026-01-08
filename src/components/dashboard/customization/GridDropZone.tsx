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
        // Larger touch target on mobile
        "min-h-[100px] sm:min-h-[120px] flex items-center justify-center",
        "group",
        isOver
          ? "border-primary bg-primary/10 scale-[1.02]"
          : "border-muted-foreground/30 hover:border-muted-foreground/50 bg-muted/5",
        // Touch feedback
        "active:bg-primary/5 active:scale-[0.98]"
      )}
      style={{
        // Convert to 1-indexed for CSS Grid
        gridRowStart: row + 1,
        gridColumnStart: col + 1,
      }}
    >
      <div className={cn(
        "text-muted-foreground/40 transition-all duration-200 p-3",
        // Always visible on mobile (no hover), hover on desktop
        "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
        isOver && "opacity-100 text-primary scale-110"
      )}>
        <Plus className="h-6 w-6 sm:h-5 sm:w-5" />
      </div>
    </div>
  );
}
