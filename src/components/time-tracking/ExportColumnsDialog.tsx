import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, RotateCcw } from "lucide-react";

export interface ExportColumn {
  key: string;
  label: string;
  defaultVisible: boolean;
}

export const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "date", label: "Date", defaultVisible: true },
  { key: "personnel", label: "Personnel", defaultVisible: true },
  { key: "project", label: "Project", defaultVisible: true },
  { key: "customer", label: "Customer", defaultVisible: true },
  { key: "hours", label: "Hours", defaultVisible: true },
  { key: "regularHours", label: "Regular Hours", defaultVisible: true },
  { key: "overtimeHours", label: "OT Hours", defaultVisible: true },
  { key: "rate", label: "Hourly Rate", defaultVisible: true },
  { key: "regularPay", label: "Regular Pay", defaultVisible: false },
  { key: "overtimePay", label: "OT Pay", defaultVisible: false },
  { key: "totalPay", label: "Total Pay", defaultVisible: true },
  { key: "billable", label: "Billable", defaultVisible: false },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "description", label: "Description", defaultVisible: false },
];

const STORAGE_KEY = "time-entry-export-columns";

interface ExportColumnsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportFormat: "excel" | "pdf" | "csv" | "json" | null;
  onConfirm: (visibleColumns: string[]) => void;
}

export function ExportColumnsDialog({
  open,
  onOpenChange,
  exportFormat,
  onConfirm,
}: ExportColumnsDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [rememberPreferences, setRememberPreferences] = useState(true);

  // Load saved preferences or defaults on mount
  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSelectedColumns(parsed);
        } catch {
          setSelectedColumns(getDefaultColumns());
        }
      } else {
        setSelectedColumns(getDefaultColumns());
      }
    }
  }, [open]);

  const getDefaultColumns = () =>
    EXPORT_COLUMNS.filter((col) => col.defaultVisible).map((col) => col.key);

  const handleToggle = (key: string) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setSelectedColumns(EXPORT_COLUMNS.map((col) => col.key));
  };

  const handleDeselectAll = () => {
    setSelectedColumns([]);
  };

  const handleReset = () => {
    setSelectedColumns(getDefaultColumns());
  };

  const handleConfirm = () => {
    if (rememberPreferences) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedColumns));
    }
    onConfirm(selectedColumns);
    onOpenChange(false);
  };

  const formatLabel = {
    excel: "Excel",
    pdf: "PDF",
    csv: "CSV",
    json: "JSON",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Settings</DialogTitle>
          <DialogDescription>
            Select columns to include in your {exportFormat ? formatLabel[exportFormat] : ""} export
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll}>
              Deselect All
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>

          {/* Column checkboxes */}
          <ScrollArea className="h-64 rounded-md border p-3">
            <div className="space-y-3">
              {EXPORT_COLUMNS.map((column) => (
                <div key={column.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`export-col-${column.key}`}
                    checked={selectedColumns.includes(column.key)}
                    onCheckedChange={() => handleToggle(column.key)}
                  />
                  <Label
                    htmlFor={`export-col-${column.key}`}
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    {column.label}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Remember preferences */}
          <div className="flex items-center space-x-2 pt-2 border-t">
            <Checkbox
              id="remember-prefs"
              checked={rememberPreferences}
              onCheckedChange={(checked) =>
                setRememberPreferences(checked === true)
              }
            />
            <Label
              htmlFor="remember-prefs"
              className="text-sm font-normal cursor-pointer"
            >
              Remember my preferences
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedColumns.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export {exportFormat ? formatLabel[exportFormat] : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
