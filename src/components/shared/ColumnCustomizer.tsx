import { useState, useEffect } from "react";
import { Settings2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ColumnConfig {
  key: string;
  label: string;
  defaultVisible?: boolean;
}

export interface ColumnCustomizerProps {
  columns: ColumnConfig[];
  visibleColumns: string[];
  onVisibleColumnsChange: (columns: string[]) => void;
  storageKey?: string;
  className?: string;
}

export function ColumnCustomizer({
  columns,
  visibleColumns,
  onVisibleColumnsChange,
  storageKey,
  className,
}: ColumnCustomizerProps) {
  const [open, setOpen] = useState(false);
  const [tempVisibleColumns, setTempVisibleColumns] = useState<string[]>(visibleColumns);

  // Sync temp state when popover opens
  useEffect(() => {
    if (open) {
      setTempVisibleColumns(visibleColumns);
    }
  }, [open, visibleColumns]);

  // Load from localStorage on mount
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`column-visibility-${storageKey}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          onVisibleColumnsChange(parsed);
        } catch (e) {
          // Invalid JSON, ignore
        }
      }
    }
  }, [storageKey]);

  const handleToggle = (key: string) => {
    setTempVisibleColumns((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key]
    );
  };

  const handleUpdate = () => {
    onVisibleColumnsChange(tempVisibleColumns);
    if (storageKey) {
      localStorage.setItem(
        `column-visibility-${storageKey}`,
        JSON.stringify(tempVisibleColumns)
      );
    }
    setOpen(false);
  };

  const handleReset = () => {
    const defaultVisible = columns
      .filter((col) => col.defaultVisible !== false)
      .map((col) => col.key);
    setTempVisibleColumns(defaultVisible);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <Settings2 className="h-4 w-4" />
          Customize
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4" align="end">
        <div className="space-y-4">
          <div className="font-medium text-sm">Visible Columns</div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {columns.map((column) => (
              <div
                key={column.key}
                className="flex items-center space-x-2 py-1"
              >
                <Checkbox
                  id={`col-${column.key}`}
                  checked={tempVisibleColumns.includes(column.key)}
                  onCheckedChange={() => handleToggle(column.key)}
                />
                <Label
                  htmlFor={`col-${column.key}`}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {column.label}
                </Label>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
            <Button size="sm" onClick={handleUpdate}>
              Update
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper hook for managing column visibility
export function useColumnVisibility(
  columns: ColumnConfig[],
  storageKey?: string
) {
  const defaultVisible = columns
    .filter((col) => col.defaultVisible !== false)
    .map((col) => col.key);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`column-visibility-${storageKey}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // Invalid JSON, use default
        }
      }
    }
    return defaultVisible;
  });

  const handleVisibleColumnsChange = (columns: string[]) => {
    setVisibleColumns(columns);
    if (storageKey) {
      localStorage.setItem(
        `column-visibility-${storageKey}`,
        JSON.stringify(columns)
      );
    }
  };

  const isColumnVisible = (key: string) => visibleColumns.includes(key);

  return {
    visibleColumns,
    setVisibleColumns: handleVisibleColumnsChange,
    isColumnVisible,
  };
}
