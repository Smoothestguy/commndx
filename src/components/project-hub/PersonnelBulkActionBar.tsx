import { useState } from "react";
import {
  MessageSquare,
  UserMinus,
  Download,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PersonnelExportDialog } from "./PersonnelExportDialog";
import type { AssignmentWithDetails } from "./PersonnelAssignmentDataGrid";
import type { ExportColumn } from "@/utils/personnelAssignmentExportUtils";

interface PersonnelBulkActionBarProps {
  selectedIds: string[];
  allAssignments: AssignmentWithDetails[];
  onClearSelection: () => void;
  onBulkSMS: () => void;
  onBulkUnassign: (ids: string[]) => Promise<void>;
  exportColumns: ExportColumn[];
  projectName?: string;
}

export function PersonnelBulkActionBar({
  selectedIds,
  allAssignments,
  onClearSelection,
  onBulkSMS,
  onBulkUnassign,
  exportColumns,
  projectName = "project",
}: PersonnelBulkActionBarProps) {
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  if (selectedIds.length === 0) return null;

  const handleBulkUnassign = async () => {
    setIsUnassigning(true);
    try {
      await onBulkUnassign(selectedIds);
      setUnassignDialogOpen(false);
      onClearSelection();
    } catch {
      toast.error("Failed to unassign personnel");
    } finally {
      setIsUnassigning(false);
    }
  };

  const selectedAssignments = allAssignments.filter((a) =>
    selectedIds.includes(a.id)
  );

  return (
    <>
      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg">
        <div className="container max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedIds.length} personnel selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Send Text */}
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkSMS}
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Send Text
              </Button>

              {/* Unassign Selected */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUnassignDialogOpen(true)}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <UserMinus className="h-4 w-4" />
                Unassign
              </Button>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                    Export selected ({selectedIds.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Unassign Confirmation Dialog */}
      <AlertDialog open={unassignDialogOpen} onOpenChange={setUnassignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign {selectedIds.length} Personnel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unassign {selectedIds.length} personnel from
              this project? This will remove them from the project but won't delete
              their time entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkUnassign}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isUnassigning}
            >
              {isUnassigning ? "Unassigning..." : "Unassign All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Dialog */}
      <PersonnelExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        assignments={selectedAssignments}
        columns={exportColumns}
        filename={`${projectName.replace(/\s+/g, "_")}_personnel`}
        scope="selected"
      />
    </>
  );
}
