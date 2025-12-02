import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

interface PersonnelGroup {
  personnelKey: string;
  personnelName: string;
  project: string;
  customer: string;
  totalHours: number;
  totalCost: number;
  entries: TimeEntryWithDetails[];
}

interface GroupedTimeTrackingTableProps {
  entries: TimeEntryWithDetails[];
  onEdit: (entry: TimeEntryWithDetails) => void;
  onBulkDelete?: (ids: string[]) => void;
  isDeleting?: boolean;
}

export function GroupedTimeTrackingTable({ 
  entries, 
  onEdit, 
  onBulkDelete, 
  isDeleting 
}: GroupedTimeTrackingTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  const getHourlyRate = (entry: TimeEntryWithDetails) => {
    return entry.personnel?.hourly_rate || entry.profiles?.hourly_rate || 0;
  };

  const getStatus = (entry: TimeEntryWithDetails): Status => {
    const status = entry.status || "pending";
    const statusMap: Record<string, Status> = {
      pending: "pending",
      invoiced: "paid",
      approved: "approved",
    };
    return statusMap[status] || "pending";
  };

  // Group entries by personnel
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, PersonnelGroup>();

    entries.forEach((entry) => {
      const personnelKey = entry.personnel_id || entry.user_id;
      const personnelName = getPersonnelName(entry);
      const hourlyRate = getHourlyRate(entry);

      if (!groups.has(personnelKey)) {
        groups.set(personnelKey, {
          personnelKey,
          personnelName,
          project: entry.projects?.name || "Unknown",
          customer: entry.projects?.customers?.name || "-",
          totalHours: 0,
          totalCost: 0,
          entries: [],
        });
      }

      const group = groups.get(personnelKey)!;
      group.totalHours += Number(entry.hours);
      group.totalCost += Number(entry.hours) * Number(hourlyRate);
      group.entries.push(entry);
    });

    // Sort entries within each group by date (newest first)
    groups.forEach((group) => {
      group.entries.sort((a, b) => 
        new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
      );
    });

    return Array.from(groups.values());
  }, [entries]);

  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  const handleSelectGroup = (group: PersonnelGroup, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    group.entries.forEach((entry) => {
      if (checked) {
        newSelection.add(entry.id);
      } else {
        newSelection.delete(entry.id);
      }
    });
    setSelectedIds(newSelection);
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

  const isGroupSelected = (group: PersonnelGroup) => {
    return group.entries.every((e) => selectedIds.has(e.id));
  };

  const isGroupIndeterminate = (group: PersonnelGroup) => {
    const selectedCount = group.entries.filter((e) => selectedIds.has(e.id)).length;
    return selectedCount > 0 && selectedCount < group.entries.length;
  };

  const handleConfirmDelete = () => {
    if (onBulkDelete && selectedIds.size > 0) {
      onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
    setShowDeleteDialog(false);
  };

  return (
    <>
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && onBulkDelete && (
        <div className="flex items-center justify-between p-3 mb-4 glass rounded-lg border border-border/50">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} {selectedIds.size === 1 ? "entry" : "entries"} selected
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

      <div className="space-y-3">
        {groupedEntries.map((group) => (
          <Collapsible
            key={group.personnelKey}
            open={expandedGroups.has(group.personnelKey)}
            onOpenChange={() => toggleGroup(group.personnelKey)}
          >
            {/* Personnel Group Header */}
            <div className="glass rounded-xl border border-border/50 overflow-hidden">
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                  {onBulkDelete && (
                    <Checkbox
                      checked={isGroupSelected(group)}
                      ref={(el) => {
                        if (el) {
                          (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = isGroupIndeterminate(group);
                        }
                      }}
                      onCheckedChange={(checked) => handleSelectGroup(group, !!checked)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select all entries for ${group.personnelName}`}
                    />
                  )}
                  
                  <div className="flex items-center">
                    {expandedGroups.has(group.personnelKey) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-2 md:gap-4 items-center">
                    <div className="md:col-span-2">
                      <p className="font-medium text-foreground">{group.personnelName}</p>
                      <p className="text-sm text-muted-foreground">{group.project}</p>
                    </div>
                    <div className="hidden md:block text-sm text-muted-foreground">
                      {group.customer}
                    </div>
                    <div className="text-sm md:text-right">
                      <span className="font-semibold text-foreground">{group.totalHours.toFixed(2)}</span>
                      <span className="text-muted-foreground ml-1">hrs</span>
                    </div>
                    <div className="text-sm md:text-right">
                      <span className="font-semibold text-foreground">${group.totalCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-end">
                      <Badge variant="secondary" className="text-xs">
                        {group.entries.length} {group.entries.length === 1 ? "entry" : "entries"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>

              {/* Expanded Date Entries */}
              <CollapsibleContent>
                <div className="border-t border-border/30 bg-muted/10">
                  <div className="divide-y divide-border/20">
                    {group.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                      >
                        {onBulkDelete && (
                          <div className="pl-8">
                            <Checkbox
                              checked={selectedIds.has(entry.id)}
                              onCheckedChange={(checked) => handleSelectOne(entry.id, !!checked)}
                              aria-label={`Select entry for ${format(new Date(entry.entry_date), "MMM dd, yyyy")}`}
                            />
                          </div>
                        )}

                        <div className={`flex-1 grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-4 items-center ${!onBulkDelete ? 'pl-12' : ''}`}>
                          <div className="text-sm text-foreground">
                            {format(new Date(entry.entry_date), "MMM dd, yyyy")}
                          </div>
                          <div className="text-sm text-right md:text-left">
                            <span className="font-medium">{Number(entry.hours).toFixed(2)}</span>
                            <span className="text-muted-foreground ml-1">hrs</span>
                          </div>
                          <div className="text-sm text-foreground">
                            ${(Number(entry.hours) * getHourlyRate(entry)).toFixed(2)}
                          </div>
                          <div>
                            <StatusBadge status={getStatus(entry)} />
                          </div>
                          <div className="text-sm text-muted-foreground truncate md:col-span-1" title={entry.description || ""}>
                            {entry.description || "-"}
                          </div>
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEdit(entry)}
                              className="h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}

        {groupedEntries.length === 0 && (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground">
            No time entries found
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entries</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} time{" "}
              {selectedIds.size === 1 ? "entry" : "entries"}? This action cannot be undone.
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
