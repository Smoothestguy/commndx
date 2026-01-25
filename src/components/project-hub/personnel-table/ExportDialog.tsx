import { useState, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { PersonnelColumnConfig, ExportFormat, ExportScope, PersonnelRowData } from "./types";
import { useAuditLog } from "@/hooks/useAuditLog";
import { toast } from "sonner";
import { exportPersonnelToCSV, exportPersonnelToXLSX } from "./exportUtils";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PersonnelRowData[];
  columns: PersonnelColumnConfig[];
  selectedIds: Set<string>;
  projectName: string;
  isAdmin: boolean;
}

export function ExportDialog({
  open,
  onOpenChange,
  data,
  columns,
  selectedIds,
  projectName,
  isAdmin,
}: ExportDialogProps) {
  const { logAction } = useAuditLog();
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [scope, setScope] = useState<ExportScope>(selectedIds.size > 0 ? "selected" : "all");
  const [exportColumns, setExportColumns] = useState<PersonnelColumnConfig[]>(
    columns.map((c) => ({ ...c }))
  );

  // Reset columns when dialog opens
  useEffect(() => {
    if (open) {
      setExportColumns(columns.map((c) => ({ ...c })));
      setScope(selectedIds.size > 0 ? "selected" : "all");
    }
  }, [open, columns, selectedIds.size]);

  const handleColumnToggle = (key: string, checked: boolean) => {
    setExportColumns((prev) =>
      prev.map((col) =>
        col.key === key ? { ...col, visible: checked } : col
      )
    );
  };

  const handleSelectAllColumns = () => {
    setExportColumns((prev) => prev.map((col) => ({ ...col, visible: true })));
  };

  const handleDeselectAllColumns = () => {
    setExportColumns((prev) => prev.map((col) => ({ ...col, visible: false })));
  };

  const handleExport = async () => {
    const visibleColumns = exportColumns.filter((c) => c.visible);
    if (visibleColumns.length === 0) {
      toast.error("Please select at least one column to export");
      return;
    }

    // Filter data based on scope
    let exportData = data;
    if (scope === "selected" && selectedIds.size > 0) {
      exportData = data.filter((d) => selectedIds.has(d.assignmentId));
    }

    if (exportData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, "_")}_Personnel_${timestamp}`;

    try {
      if (format === "csv") {
        exportPersonnelToCSV(exportData, visibleColumns, filename, isAdmin);
      } else {
        exportPersonnelToXLSX(exportData, visibleColumns, filename, isAdmin);
      }

      // Log the export action
      await logAction({
        actionType: "download",
        resourceType: "personnel",
        metadata: {
          exportType: "personnel_assignments",
          format,
          scope,
          rowCount: exportData.length,
          columnsExported: visibleColumns.map((c) => c.key),
        },
      });

      toast.success(`Exported ${exportData.length} personnel to ${format.toUpperCase()}`);
      onOpenChange(false);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export personnel data");
    }
  };

  const visibleColumnCount = exportColumns.filter((c) => c.visible).length;
  const exportCount = scope === "selected" && selectedIds.size > 0 
    ? selectedIds.size 
    : data.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Personnel
          </DialogTitle>
          <DialogDescription>
            Export {exportCount} personnel{scope === "selected" ? " (selected)" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(value) => setFormat(value as ExportFormat)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="xlsx" id="xlsx" />
                <Label
                  htmlFor="xlsx"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  Excel (.xlsx)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label
                  htmlFor="csv"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-blue-600" />
                  CSV (.csv)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Scope Selection */}
          {selectedIds.size > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Export Scope</Label>
              <RadioGroup
                value={scope}
                onValueChange={(value) => setScope(value as ExportScope)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="selected" />
                  <Label htmlFor="selected" className="cursor-pointer">
                    Selected only ({selectedIds.size})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="cursor-pointer">
                    All personnel ({data.length})
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Column Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Columns ({visibleColumnCount} selected)
              </Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllColumns}
                  className="h-7 text-xs"
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAllColumns}
                  className="h-7 text-xs"
                >
                  None
                </Button>
              </div>
            </div>
            <ScrollArea className="h-[200px] rounded-md border p-3">
              <div className="space-y-2">
                {exportColumns.map((column) => (
                  <div key={column.key} className="flex items-center space-x-3">
                    <Checkbox
                      id={`export-col-${column.key}`}
                      checked={column.visible}
                      onCheckedChange={(checked) =>
                        handleColumnToggle(column.key, !!checked)
                      }
                    />
                    <Label
                      htmlFor={`export-col-${column.key}`}
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
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={visibleColumnCount === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export {format.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
