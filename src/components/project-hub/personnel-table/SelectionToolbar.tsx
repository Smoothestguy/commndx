import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelectionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onExportSelected: () => void;
}

export function SelectionToolbar({
  selectedCount,
  onClearSelection,
  onExportSelected,
}: SelectionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg">
      <span className="text-sm font-medium text-primary">
        {selectedCount} selected
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="h-7 text-xs gap-1 text-muted-foreground"
      >
        <X className="h-3 w-3" />
        Clear
      </Button>
      <div className="flex-1" />
      <Button
        variant="outline"
        size="sm"
        onClick={onExportSelected}
        className="h-7 gap-1"
      >
        <Download className="h-3 w-3" />
        Export Selected
      </Button>
    </div>
  );
}
