import { useState } from "react";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IndeterminateCheckbox } from "@/components/ui/indeterminate-checkbox";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type Status = 
  | "draft" 
  | "pending" 
  | "pending_approval"
  | "approved" 
  | "sent" 
  | "paid" 
  | "overdue" 
  | "active" 
  | "inactive"
  | "in-progress"
  | "on-hold"
  | "completed"
  | "acknowledged"
  | "cancelled"
  | "delayed";

interface TimeTrackingTableProps {
  entries: TimeEntryWithDetails[];
  onEdit: (entry: TimeEntryWithDetails) => void;
  onBulkDelete?: (ids: string[]) => void;
  isDeleting?: boolean;
}

export function TimeTrackingTable({ entries, onEdit, onBulkDelete, isDeleting }: TimeTrackingTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const allSelected = entries.length > 0 && selectedIds.size === entries.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < entries.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(entries.map(e => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedIds(newSelection);
  };

  const handleConfirmDelete = () => {
    if (onBulkDelete && selectedIds.size > 0) {
      onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
    setShowDeleteDialog(false);
  };

  const getPersonnelName = (entry: TimeEntryWithDetails) => {
    if (entry.personnel_id && entry.personnel) {
      return `${entry.personnel.first_name} ${entry.personnel.last_name}`;
    }
    const profile = entry.profiles;
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return profile?.email || "Unknown";
  };

  const getCost = (entry: TimeEntryWithDetails) => {
    const hourlyRate = entry.personnel?.hourly_rate || entry.profiles?.hourly_rate || 0;
    const cost = Number(entry.hours) * Number(hourlyRate);
    return `$${cost.toFixed(2)}`;
  };

  const getStatus = (entry: TimeEntryWithDetails) => {
    const status = entry.status || "pending";
    const statusMap: Record<string, Status> = {
      pending: "pending",
      invoiced: "paid",
      approved: "approved",
    };
    return statusMap[status] || "pending";
  };

  return (
    <>
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && onBulkDelete && (
        <div className="flex items-center justify-between p-3 mb-4 glass rounded-lg border border-border/50">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} {selectedIds.size === 1 ? 'entry' : 'entries'} selected
          </span>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              {onBulkDelete && (
                <TableHead className="w-[50px]">
                  <IndeterminateCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              <TableHead className="w-[120px] text-muted-foreground font-medium">Date</TableHead>
              <TableHead className="min-w-[150px] text-muted-foreground font-medium">Personnel</TableHead>
              <TableHead className="min-w-[150px] text-muted-foreground font-medium">Project</TableHead>
              <TableHead className="min-w-[150px] text-muted-foreground font-medium">Customer</TableHead>
              <TableHead className="w-[80px] text-right text-muted-foreground font-medium">Hours</TableHead>
              <TableHead className="w-[100px] text-right text-muted-foreground font-medium">Cost</TableHead>
              <TableHead className="w-[100px] text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="min-w-[150px] text-muted-foreground font-medium">Notes</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                className="border-border/30 transition-colors duration-200"
              >
                {onBulkDelete && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(entry.id)}
                      onCheckedChange={(checked) => handleSelectOne(entry.id, !!checked)}
                      aria-label={`Select entry for ${getPersonnelName(entry)}`}
                    />
                  </TableCell>
                )}
                <TableCell className="text-foreground">
                  {format(new Date(entry.entry_date), "MMM dd, yyyy")}
                </TableCell>
                <TableCell className="text-foreground">
                  <div className="flex items-center gap-2">
                    <PersonnelAvatar
                      photoUrl={entry.personnel?.photo_url}
                      firstName={entry.personnel?.first_name || entry.profiles?.first_name || ""}
                      lastName={entry.personnel?.last_name || entry.profiles?.last_name || ""}
                      size="xs"
                    />
                    {getPersonnelName(entry)}
                  </div>
                </TableCell>
                <TableCell className="text-foreground">
                  {entry.projects?.name || "Unknown"}
                </TableCell>
                <TableCell className="text-foreground">
                  {entry.projects?.customers?.name || "-"}
                </TableCell>
                <TableCell className="text-foreground text-right">
                  {Number(entry.hours).toFixed(2)}
                </TableCell>
                <TableCell className="text-foreground text-right">
                  {getCost(entry)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={getStatus(entry)} />
                </TableCell>
                <TableCell className="text-foreground">
                  <div className="max-w-[200px] truncate" title={entry.description || ""}>
                    {entry.description || "-"}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(entry)}
                    className="h-8 w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entries</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} time {selectedIds.size === 1 ? 'entry' : 'entries'}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
