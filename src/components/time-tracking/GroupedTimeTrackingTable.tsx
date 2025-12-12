import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Pencil, Trash2, AlertTriangle, Gift, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useIsMobile } from "@/hooks/use-mobile";
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
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
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
  const isMobile = useIsMobile();

  const { data: companySettings } = useCompanySettings();
  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const holidayMultiplier = companySettings?.holiday_multiplier ?? 1.5;
  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;

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

  // Calculate cost for a single entry with multipliers
  const getEntryCost = (entry: TimeEntryWithDetails) => {
    const hourlyRate = getHourlyRate(entry);
    const regular = Number(entry.regular_hours || entry.hours);
    const overtime = Number(entry.overtime_hours || 0);
    const isHoliday = entry.is_holiday;
    
    let regularCost = regular * hourlyRate;
    let overtimeCost = overtime * hourlyRate * overtimeMultiplier;
    
    if (isHoliday) {
      regularCost *= holidayMultiplier;
      overtimeCost *= holidayMultiplier;
    }
    
    return regularCost + overtimeCost;
  };

  // Group entries by personnel
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, PersonnelGroup>();

    entries.forEach((entry) => {
      const personnelKey = entry.personnel_id || entry.user_id;
      const personnelName = getPersonnelName(entry);

      if (!groups.has(personnelKey)) {
        groups.set(personnelKey, {
          personnelKey,
          personnelName,
          project: entry.projects?.name || "Unknown",
          customer: entry.projects?.customers?.name || "-",
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          holidayHours: 0,
          totalCost: 0,
          entries: [],
        });
      }

      const group = groups.get(personnelKey)!;
      group.totalHours += Number(entry.hours);
      if (entry.is_holiday) {
        group.holidayHours += Number(entry.hours);
      }
      group.entries.push(entry);
    });

    // Calculate weekly overtime for each group (hours over threshold)
    groups.forEach((group) => {
      // Calculate weekly overtime based on total hours vs threshold
      group.regularHours = Math.min(group.totalHours, weeklyOvertimeThreshold);
      group.overtimeHours = Math.max(0, group.totalHours - weeklyOvertimeThreshold);
      
      // Recalculate total cost with weekly overtime
      const hourlyRate = group.entries[0] ? getHourlyRate(group.entries[0]) : 0;
      const regularCost = group.regularHours * hourlyRate;
      const overtimeCost = group.overtimeHours * hourlyRate * overtimeMultiplier;
      
      // Add holiday multiplier for holiday hours
      const holidayBonus = group.holidayHours * hourlyRate * (holidayMultiplier - 1);
      
      group.totalCost = regularCost + overtimeCost + holidayBonus;
      
      // Sort entries within each group by date (newest first)
      group.entries.sort((a, b) => 
        new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
      );
    });

    return Array.from(groups.values());
  }, [entries, overtimeMultiplier, holidayMultiplier, weeklyOvertimeThreshold]);

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

  // Select All logic
  const allSelected = entries.length > 0 && entries.every(e => selectedIds.has(e.id));
  const someSelected = entries.some(e => selectedIds.has(e.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(entries.map(e => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleConfirmDelete = () => {
    if (onBulkDelete && selectedIds.size > 0) {
      onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
    setShowDeleteDialog(false);
  };

  // Mobile Card View
  if (isMobile) {
    return (
      <>
        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && onBulkDelete && (
          <div className="flex items-center justify-between p-3 mb-4 glass rounded-lg border border-border/50">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        )}

        <div className="w-full max-w-full overflow-hidden space-y-3">
          {/* Select All Header */}
          {onBulkDelete && groupedEntries.length > 0 && (
            <div className="glass rounded-xl border border-border/50 p-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = someSelected;
                    }
                  }}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  aria-label="Select all entries"
                />
                <span className="text-sm font-medium">
                  Select All ({entries.length})
                </span>
              </div>
            </div>
          )}

          {groupedEntries.map((group) => (
            <Card key={group.personnelKey} className="p-3 space-y-3">
              {/* Group Header */}
              <div className="flex items-start gap-3">
                {onBulkDelete && (
                  <Checkbox
                    checked={isGroupSelected(group)}
                    ref={(el) => {
                      if (el) {
                        (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = isGroupIndeterminate(group);
                      }
                    }}
                    onCheckedChange={(checked) => handleSelectGroup(group, !!checked)}
                    className="mt-1"
                    aria-label={`Select all entries for ${group.personnelName}`}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{group.personnelName}</p>
                  <p className="text-sm text-muted-foreground truncate">{group.project}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleGroup(group.personnelKey)}
                  className="shrink-0"
                >
                  {expandedGroups.has(group.personnelKey) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/30 rounded-lg p-2">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="text-xs">Hours</span>
                  </div>
                  <p className="font-semibold text-sm">{group.totalHours.toFixed(1)}h</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    <span className="text-xs">Cost</span>
                  </div>
                  <p className="font-semibold text-sm">${group.totalCost.toFixed(0)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <span className="text-xs">Entries</span>
                  </div>
                  <p className="font-semibold text-sm">{group.entries.length}</p>
                </div>
              </div>

              {/* Badges */}
              {(group.overtimeHours > 0 || group.holidayHours > 0) && (
                <div className="flex gap-1 flex-wrap">
                  {group.overtimeHours > 0 && (
                    <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20">
                      OT: {group.overtimeHours.toFixed(1)}h
                    </Badge>
                  )}
                  {group.holidayHours > 0 && (
                    <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
                      Holiday: {group.holidayHours.toFixed(1)}h
                    </Badge>
                  )}
                </div>
              )}

              {/* Expanded Entries */}
              {expandedGroups.has(group.personnelKey) && (
                <div className="border-t border-border/30 pt-3 space-y-2">
                  {group.entries.map((entry) => {
                    const hasOvertime = Number(entry.overtime_hours || 0) > 0;
                    const isHoliday = entry.is_holiday;
                    const entryCost = getEntryCost(entry);
                    
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg"
                      >
                        {onBulkDelete && (
                          <Checkbox
                            checked={selectedIds.has(entry.id)}
                            onCheckedChange={(checked) => handleSelectOne(entry.id, !!checked)}
                            aria-label={`Select entry for ${format(new Date(entry.entry_date), "MMM dd")}`}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">
                              {format(new Date(entry.entry_date), "MMM dd")}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{Number(entry.hours).toFixed(1)}h</span>
                              <span className="text-sm text-muted-foreground">${entryCost.toFixed(0)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <StatusBadge status={getStatus(entry)} />
                            {hasOvertime && (
                              <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20">
                                <AlertTriangle className="h-2 w-2 mr-0.5" />
                                OT
                              </Badge>
                            )}
                            {isHoliday && (
                              <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
                                <Gift className="h-2 w-2 mr-0.5" />
                                Hol
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(entry)}
                          className="h-8 w-8 shrink-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
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

  // Desktop Table View
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
        {/* Select All Header */}
        {onBulkDelete && groupedEntries.length > 0 && (
          <div className="glass rounded-xl border border-border/50 p-3">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = someSelected;
                  }
                }}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                aria-label="Select all entries"
              />
              <span className="text-sm font-medium">
                Select All ({entries.length} {entries.length === 1 ? "entry" : "entries"})
              </span>
            </div>
          </div>
        )}

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
                      {/* Show breakdown badges */}
                      <div className="flex gap-1 mt-1 justify-end flex-wrap">
                        {group.overtimeHours > 0 && (
                          <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20">
                            OT: {group.overtimeHours.toFixed(1)}h
                          </Badge>
                        )}
                        {group.holidayHours > 0 && (
                          <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
                            Holiday: {group.holidayHours.toFixed(1)}h
                          </Badge>
                        )}
                      </div>
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
                    {group.entries.map((entry) => {
                      const hasOvertime = Number(entry.overtime_hours || 0) > 0;
                      const isHoliday = entry.is_holiday;
                      const entryCost = getEntryCost(entry);
                      
                      return (
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

                          <div className={`flex-1 grid grid-cols-2 md:grid-cols-7 gap-2 md:gap-4 items-center ${!onBulkDelete ? 'pl-12' : ''}`}>
                            <div className="text-sm text-foreground">
                              {format(new Date(entry.entry_date), "MMM dd, yyyy")}
                            </div>
                            <div className="text-sm text-right md:text-left">
                              <span className="font-medium">{Number(entry.hours).toFixed(2)}</span>
                              <span className="text-muted-foreground ml-1">hrs</span>
                            </div>
                            <div className="text-sm text-foreground">
                              ${entryCost.toFixed(2)}
                            </div>
                            <div>
                              <StatusBadge status={getStatus(entry)} />
                            </div>
                            {/* OT/Holiday badges */}
                            <div className="flex gap-1">
                              {hasOvertime && (
                                <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20 gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  OT +{Number(entry.overtime_hours).toFixed(1)}h
                                </Badge>
                              )}
                              {isHoliday && (
                                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20 gap-1">
                                  <Gift className="h-3 w-3" />
                                  Holiday
                                </Badge>
                              )}
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
                      );
                    })}
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
