import { useState, useEffect } from "react";
import { Settings2, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { PersonnelColumnConfig } from "./types";

interface ColumnPickerProps {
  columns: PersonnelColumnConfig[];
  onColumnsChange: (columns: PersonnelColumnConfig[]) => void;
}

export function ColumnPicker({ columns, onColumnsChange }: ColumnPickerProps) {
  const [open, setOpen] = useState(false);

  const handleToggle = (key: string, checked: boolean) => {
    onColumnsChange(
      columns.map((col) =>
        col.key === key ? { ...col, visible: checked } : col
      )
    );
  };

  const handleReset = () => {
    onColumnsChange(
      columns.map((col) => ({ ...col, visible: col.defaultVisible }))
    );
  };

  const visibleCount = columns.filter((c) => c.visible).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Columns</span>
          <span className="text-xs text-muted-foreground">({visibleCount})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Toggle Columns</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 text-xs gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>
        <ScrollArea className="h-[280px]">
          <div className="p-2 space-y-1">
            {columns.map((column) => (
              <div
                key={column.key}
                className="flex items-center space-x-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                onClick={() => handleToggle(column.key, !column.visible)}
              >
                <Checkbox
                  id={`col-${column.key}`}
                  checked={column.visible}
                  onCheckedChange={(checked) =>
                    handleToggle(column.key, !!checked)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
                <Label
                  htmlFor={`col-${column.key}`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  {column.label}
                </Label>
                {column.visible && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
