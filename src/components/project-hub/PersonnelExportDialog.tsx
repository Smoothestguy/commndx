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
import {
  transformAssignmentToExportRow,
  performExport,
  type ExportColumn,
  type ExportFormat,
  type ExportScope,
} from "@/utils/personnelAssignmentExportUtils";
import type { AssignmentWithDetails } from "./PersonnelAssignmentDataGrid";
import { useAuditLog } from "@/hooks/useAuditLog";
import { toast } from "sonner";

interface PersonnelExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: AssignmentWithDetails[];
  columns: ExportColumn[];
  filename: string;
  scope?: ExportScope;
  totalFilteredCount?: number;
}

export function PersonnelExportDialog({
  open,
  onOpenChange,
  assignments,
  columns: initialColumns,
  filename,
  scope: initialScope = "selected",
  totalFilteredCount,
}: PersonnelExportDialogProps) {
  const { logAction } = useAuditLog();
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [scope, setScope] = useState<ExportScope>(initialScope);
  const [columns, setColumns] = useState<ExportColumn[]>(initialColumns);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setColumns(initialColumns);
      setScope(initialScope);
    }
  }, [open, initialColumns, initialScope]);

  const handleColumnToggle = (key: string, checked: boolean) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.key === key ? { ...col, visible: checked } : col
      )
    );
  };

  const handleSelectAllColumns = () => {
    setColumns((prev) => prev.map((col) => ({ ...col, visible: true })));
  };

  const handleDeselectAllColumns = () => {
    setColumns((prev) => prev.map((col) => ({ ...col, visible: false })));
  };

  const handleExport = async () => {
    const visibleColumns = columns.filter((c) => c.visible);
    if (visibleColumns.length === 0) {
      toast.error("Please select at least one column to export");
      return;
    }

    const exportData = assignments.map(transformAssignmentToExportRow);

    performExport(
      exportData,
      {
        format,
        scope,
        columns,
        selectedIds: assignments.map((a) => a.id),
      },
      filename
    );

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
  };

  const visibleColumnCount = columns.filter((c) => c.visible).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Personnel
          </DialogTitle>
          <DialogDescription>
            Export {assignments.length} personnel assignments
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
          {totalFilteredCount && totalFilteredCount !== assignments.length && (
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
                    Selected rows only ({assignments.length})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="filtered" id="filtered" />
                  <Label htmlFor="filtered" className="cursor-pointer">
                    All filtered rows ({totalFilteredCount})
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
            <ScrollArea className="h-[180px] rounded-md border p-3">
              <div className="space-y-3">
                {columns.map((column) => (
                  <div key={column.key} className="flex items-center space-x-3">
                    <Checkbox
                      id={`col-${column.key}`}
                      checked={column.visible}
                      onCheckedChange={(checked) =>
                        handleColumnToggle(column.key, !!checked)
                      }
                    />
                    <Label
                      htmlFor={`col-${column.key}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {column.label}
                      {column.requiresPermission && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (restricted)
                        </span>
                      )}
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
