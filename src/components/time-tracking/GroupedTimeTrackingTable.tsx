import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Pencil, Trash2, Gift, Clock, DollarSign, Check, X, FileText, Receipt, ClipboardList, CircleDollarSign, Lock, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IndeterminateCheckbox } from "@/components/ui/indeterminate-checkbox";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ComplianceBadge } from "@/components/personnel/ComplianceBadge";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  personnelData: TimeEntryWithDetails["personnel"] | null;
  project: string;
  customer: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
  totalCost: number;
  entries: TimeEntryWithDetails[];
}

// Helper to extract compliance-relevant fields from personnel data
const getComplianceData = (personnel: TimeEntryWithDetails["personnel"]) => {
  if (!personnel) return null;
  return {
    everify_status: personnel.everify_status,
    everify_expiry: personnel.everify_expiry,
    work_auth_expiry: personnel.work_auth_expiry,
    i9_completed_at: personnel.i9_completed_at,
  };
};

interface GroupedTimeTrackingTableProps {
  entries: TimeEntryWithDetails[];
  onEdit: (entry: TimeEntryWithDetails) => void;
  onBulkDelete?: (ids: string[]) => void;
  onStatusChange?: (ids: string[], status: string) => void;
  onCreateVendorBill?: (entries: TimeEntryWithDetails[]) => void;
  onCreateCustomerInvoice?: (entries: TimeEntryWithDetails[]) => void;
  isDeleting?: boolean;
  isUpdatingStatus?: boolean;
  isWeekLocked?: boolean;
  lockedEntryIds?: Set<string>;
}

type SortKey = 'personnelName' | 'project' | 'customer' | 'totalHours' | 'totalCost' | 'entries';
type SortDirection = 'asc' | 'desc';

export function GroupedTimeTrackingTable({
  entries, 
  onEdit, 
  onBulkDelete, 
  onStatusChange,
  onCreateVendorBill,
  onCreateCustomerInvoice,
  isDeleting,
  isUpdatingStatus,
  isWeekLocked = false,
  lockedEntryIds = new Set()
}: GroupedTimeTrackingTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('personnelName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const isMobile = useIsMobile();

  const { data: companySettings } = useCompanySettings();
  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const holidayMultiplier = companySettings?.holiday_multiplier ?? 2.0;
  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return ArrowUpDown;
    return sortDirection === 'asc' ? ArrowUp : ArrowDown;
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

  const getHourlyRate = (entry: TimeEntryWithDetails) => {
    // Prioritize snapshotted hourly_rate on entry, fall back to personnel/profile rate
    return entry.hourly_rate || entry.personnel?.hourly_rate || entry.profiles?.hourly_rate || 0;
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
          personnelData: entry.personnel || null,
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
      const hourlyRate = group.entries[0] ? getHourlyRate(group.entries[0]) : 0;
      
      // Holiday hours are paid at full holiday rate, not included in regular/OT calculation
      const nonHolidayHours = group.totalHours - group.holidayHours;
      const nonHolidayRegular = Math.min(nonHolidayHours, weeklyOvertimeThreshold);
      const nonHolidayOT = Math.max(0, nonHolidayHours - weeklyOvertimeThreshold);
      
      // Store the display values (including holiday in totals for summary)
      group.regularHours = nonHolidayRegular;
      group.overtimeHours = nonHolidayOT;
      
      // Calculate costs correctly: holiday hours at full multiplier, not as bonus
      const regularCost = nonHolidayRegular * hourlyRate;
      const overtimeCost = nonHolidayOT * hourlyRate * overtimeMultiplier;
      const holidayCost = group.holidayHours * hourlyRate * holidayMultiplier;
      
      group.totalCost = regularCost + overtimeCost + holidayCost;
      
      // Sort entries within each group by date (newest first)
      group.entries.sort((a, b) => 
        new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
      );
    });

    // Sort groups
    const groupsArray = Array.from(groups.values());
    groupsArray.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortKey) {
        case 'personnelName':
          aValue = a.personnelName;
          bValue = b.personnelName;
          break;
        case 'project':
          aValue = a.project;
          bValue = b.project;
          break;
        case 'customer':
          aValue = a.customer;
          bValue = b.customer;
          break;
        case 'totalHours':
          aValue = a.totalHours;
          bValue = b.totalHours;
          break;
        case 'totalCost':
          aValue = a.totalCost;
          bValue = b.totalCost;
          break;
        case 'entries':
          aValue = a.entries.length;
          bValue = b.entries.length;
          break;
        default:
          aValue = a.personnelName;
          bValue = b.personnelName;
      }
      
      const comparison = typeof aValue === 'string' 
        ? aValue.localeCompare(bValue as string)
        : (aValue as number) - (bValue as number);
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return groupsArray;
  }, [entries, overtimeMultiplier, holidayMultiplier, weeklyOvertimeThreshold, sortKey, sortDirection]);

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
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between p-3 mb-4 glass rounded-lg border border-border/50 flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              {onStatusChange && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onStatusChange(Array.from(selectedIds), 'approved');
                      setSelectedIds(new Set());
                    }}
                    disabled={isUpdatingStatus}
                    className="text-green-600 border-green-600/30 hover:bg-green-600/10"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onStatusChange(Array.from(selectedIds), 'rejected');
                      setSelectedIds(new Set());
                    }}
                    disabled={isUpdatingStatus}
                    className="text-red-600 border-red-600/30 hover:bg-red-600/10"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </>
              )}
              {onCreateVendorBill && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const selectedEntryList = entries.filter(e => selectedIds.has(e.id));
                    onCreateVendorBill(selectedEntryList);
                  }}
                  className="text-blue-600 border-blue-600/30 hover:bg-blue-600/10"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Create Bill
                </Button>
              )}
              {onCreateCustomerInvoice && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const selectedEntryList = entries.filter(e => selectedIds.has(e.id));
                    onCreateCustomerInvoice(selectedEntryList);
                  }}
                  className="text-green-600 border-green-600/30 hover:bg-green-600/10"
                >
                  <Receipt className="h-4 w-4 mr-1" />
                  Invoice Customer
                </Button>
              )}
              {onBulkDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="w-full max-w-full overflow-hidden space-y-3">
          {/* Select All Header */}
          {onBulkDelete && groupedEntries.length > 0 && (
            <div className="glass rounded-xl border border-border/50 p-3">
              <div className="flex items-center gap-3">
              <IndeterminateCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
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
                  <IndeterminateCheckbox
                    checked={isGroupSelected(group)}
                    indeterminate={isGroupIndeterminate(group)}
                    onCheckedChange={(checked) => handleSelectGroup(group, !!checked)}
                    className="mt-1"
                    aria-label={`Select all entries for ${group.personnelName}`}
                  />
                )}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <PersonnelAvatar
                    photoUrl={group.personnelData?.photo_url}
                    firstName={group.personnelData?.first_name || ""}
                    lastName={group.personnelData?.last_name || ""}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-foreground truncate">{group.personnelName}</p>
                      <ComplianceBadge personnel={getComplianceData(group.personnelData)} compact />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{group.project}</p>
                  </div>
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
                              <span className="text-sm">{Number(entry.hours).toFixed(2)}h</span>
                              <span className="text-sm text-muted-foreground">${entryCost.toFixed(0)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <StatusBadge status={getStatus(entry)} />
                            {isHoliday && (
                              <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
                                <Gift className="h-2 w-2 mr-0.5" />
                                Hol
                              </Badge>
                            )}
                            {entry.vendor_bill_id && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20">
                                    <ClipboardList className="h-2 w-2 mr-0.5" />
                                    Billed
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Vendor bill created</TooltipContent>
                              </Tooltip>
                            )}
                            {entry.invoice_id && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                                    <CircleDollarSign className="h-2 w-2 mr-0.5" />
                                    Invoiced
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Customer invoice created</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                        {isWeekLocked || lockedEntryIds.has(entry.id) ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="h-8 w-8 shrink-0 flex items-center justify-center">
                                <Lock className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Entry locked - week is closed</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(entry)}
                            className="h-8 w-8 shrink-0"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
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
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 mb-4 glass rounded-lg border border-border/50 flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} {selectedIds.size === 1 ? "entry" : "entries"} selected
          </span>
          <div className="flex items-center gap-2">
            {onStatusChange && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onStatusChange(Array.from(selectedIds), 'approved');
                    setSelectedIds(new Set());
                  }}
                  disabled={isUpdatingStatus}
                  className="text-green-600 border-green-600/30 hover:bg-green-600/10"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onStatusChange(Array.from(selectedIds), 'rejected');
                    setSelectedIds(new Set());
                  }}
                  disabled={isUpdatingStatus}
                  className="text-red-600 border-red-600/30 hover:bg-red-600/10"
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
            {onCreateVendorBill && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const selectedEntryList = entries.filter(e => selectedIds.has(e.id));
                  onCreateVendorBill(selectedEntryList);
                }}
                className="text-blue-600 border-blue-600/30 hover:bg-blue-600/10"
              >
                <FileText className="h-4 w-4 mr-1" />
                Create Bill
              </Button>
            )}
            {onCreateCustomerInvoice && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const selectedEntryList = entries.filter(e => selectedIds.has(e.id));
                  onCreateCustomerInvoice(selectedEntryList);
                }}
                className="text-green-600 border-green-600/30 hover:bg-green-600/10"
              >
                <Receipt className="h-4 w-4 mr-1" />
                Invoice Customer
              </Button>
            )}
            {onBulkDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="bg-table-header hover:bg-table-header border-b border-table-border">
              {onBulkDelete && (
                <TableHead className="w-10 text-table-header-foreground font-semibold py-2 px-3 h-9">
                  <IndeterminateCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                    className="border-table-header-foreground/50"
                  />
                </TableHead>
              )}
              <TableHead className="w-10 text-table-header-foreground font-semibold py-2 px-3 h-9">
                {/* Expand/collapse icon column */}
              </TableHead>
              <TableHead 
                className="text-table-header-foreground font-semibold py-2 px-3 h-9 cursor-pointer select-none whitespace-nowrap"
                onClick={() => handleSort('personnelName')}
              >
                <div className="flex items-center gap-1">
                  <span>Personnel</span>
                  {(() => {
                    const Icon = getSortIcon('personnelName');
                    return <Icon className={cn("h-3.5 w-3.5", sortKey === 'personnelName' ? "text-primary" : "text-table-header-foreground/50")} />;
                  })()}
                </div>
              </TableHead>
              <TableHead 
                className="text-table-header-foreground font-semibold py-2 px-3 h-9 cursor-pointer select-none whitespace-nowrap"
                onClick={() => handleSort('project')}
              >
                <div className="flex items-center gap-1">
                  <span>Project</span>
                  {(() => {
                    const Icon = getSortIcon('project');
                    return <Icon className={cn("h-3.5 w-3.5", sortKey === 'project' ? "text-primary" : "text-table-header-foreground/50")} />;
                  })()}
                </div>
              </TableHead>
              <TableHead 
                className="text-table-header-foreground font-semibold py-2 px-3 h-9 cursor-pointer select-none whitespace-nowrap"
                onClick={() => handleSort('customer')}
              >
                <div className="flex items-center gap-1">
                  <span>Customer</span>
                  {(() => {
                    const Icon = getSortIcon('customer');
                    return <Icon className={cn("h-3.5 w-3.5", sortKey === 'customer' ? "text-primary" : "text-table-header-foreground/50")} />;
                  })()}
                </div>
              </TableHead>
              <TableHead 
                className="text-table-header-foreground font-semibold py-2 px-3 h-9 cursor-pointer select-none whitespace-nowrap text-right"
                onClick={() => handleSort('totalHours')}
              >
                <div className="flex items-center gap-1 justify-end">
                  <span>Hours</span>
                  {(() => {
                    const Icon = getSortIcon('totalHours');
                    return <Icon className={cn("h-3.5 w-3.5", sortKey === 'totalHours' ? "text-primary" : "text-table-header-foreground/50")} />;
                  })()}
                </div>
              </TableHead>
              <TableHead 
                className="text-table-header-foreground font-semibold py-2 px-3 h-9 cursor-pointer select-none whitespace-nowrap text-right"
                onClick={() => handleSort('totalCost')}
              >
                <div className="flex items-center gap-1 justify-end">
                  <span>Cost</span>
                  {(() => {
                    const Icon = getSortIcon('totalCost');
                    return <Icon className={cn("h-3.5 w-3.5", sortKey === 'totalCost' ? "text-primary" : "text-table-header-foreground/50")} />;
                  })()}
                </div>
              </TableHead>
              <TableHead 
                className="text-table-header-foreground font-semibold py-2 px-3 h-9 cursor-pointer select-none whitespace-nowrap text-right"
                onClick={() => handleSort('entries')}
              >
                <div className="flex items-center gap-1 justify-end">
                  <span>Entries</span>
                  {(() => {
                    const Icon = getSortIcon('entries');
                    return <Icon className={cn("h-3.5 w-3.5", sortKey === 'entries' ? "text-primary" : "text-table-header-foreground/50")} />;
                  })()}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedEntries.map((group, groupIndex) => (
              <Collapsible
                key={group.personnelKey}
                open={expandedGroups.has(group.personnelKey)}
                onOpenChange={() => toggleGroup(group.personnelKey)}
                asChild
              >
                <>
                  {/* Group Header Row */}
                  <CollapsibleTrigger asChild>
                    <TableRow
                      className={cn(
                        "border-b border-table-border transition-colors duration-100 cursor-pointer",
                        groupIndex % 2 === 1 && "bg-table-stripe",
                        "hover:bg-muted/50"
                      )}
                    >
                      {onBulkDelete && (
                        <TableCell className="py-1.5 px-3 w-10">
                          <IndeterminateCheckbox
                            checked={isGroupSelected(group)}
                            indeterminate={isGroupIndeterminate(group)}
                            onCheckedChange={(checked) => handleSelectGroup(group, !!checked)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select all entries for ${group.personnelName}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="py-1.5 px-3 w-10">
                        {expandedGroups.has(group.personnelKey) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-primary">{group.personnelName}</span>
                          <ComplianceBadge personnel={getComplianceData(group.personnelData)} compact />
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-foreground">
                        {group.project}
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-muted-foreground">
                        {group.customer}
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-right">
                        <div className="font-semibold text-foreground">{group.totalHours.toFixed(2)}h</div>
                        {(group.overtimeHours > 0 || group.holidayHours > 0) && (
                          <div className="flex gap-1 mt-0.5 justify-end flex-wrap">
                            {group.overtimeHours > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-500/10 text-orange-500 border-orange-500/20">
                                OT: {group.overtimeHours.toFixed(1)}h
                              </Badge>
                            )}
                            {group.holidayHours > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-500/10 text-purple-500 border-purple-500/20">
                                Hol: {group.holidayHours.toFixed(1)}h
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-right font-semibold text-foreground">
                        ${group.totalCost.toFixed(2)}
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-right">
                        <Badge variant="secondary" className="text-[10px]">
                          {group.entries.length}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </CollapsibleTrigger>

                  {/* Expanded Detail Rows */}
                  <CollapsibleContent asChild>
                    <>
                      {group.entries.map((entry, entryIndex) => {
                        const isHoliday = entry.is_holiday;
                        const entryCost = getEntryCost(entry);
                        const isLocked = isWeekLocked || lockedEntryIds.has(entry.id);
                        
                        return (
                          <TableRow
                            key={entry.id}
                            className={cn(
                              "border-b border-table-border/50 transition-colors duration-100",
                              "bg-muted/30 hover:bg-muted/50"
                            )}
                          >
                            {onBulkDelete && (
                              <TableCell className="py-1.5 px-3 w-10">
                                <div className="pl-4">
                                  <Checkbox
                                    checked={selectedIds.has(entry.id)}
                                    onCheckedChange={(checked) => handleSelectOne(entry.id, !!checked)}
                                    aria-label={`Select entry for ${format(new Date(entry.entry_date), "MMM dd, yyyy")}`}
                                  />
                                </div>
                              </TableCell>
                            )}
                            <TableCell className="py-1.5 px-3 w-10">
                              {/* Empty for alignment */}
                            </TableCell>
                            <TableCell className="py-1.5 px-3 pl-8 text-sm text-foreground">
                              {format(new Date(entry.entry_date), "MMM dd, yyyy")}
                            </TableCell>
                            <TableCell className="py-1.5 px-3">
                              <StatusBadge status={getStatus(entry)} />
                            </TableCell>
                            <TableCell className="py-1.5 px-3">
                              <div className="flex gap-1 flex-wrap">
                                {isHoliday && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-500/10 text-purple-500 border-purple-500/20 gap-0.5">
                                    <Gift className="h-2.5 w-2.5" />
                                    Holiday
                                  </Badge>
                                )}
                                {entry.vendor_bill_id && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-500/10 text-blue-500 border-blue-500/20 gap-0.5">
                                        <ClipboardList className="h-2.5 w-2.5" />
                                        Billed
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>Vendor bill created</TooltipContent>
                                  </Tooltip>
                                )}
                                {entry.invoice_id && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-500/10 text-green-500 border-green-500/20 gap-0.5">
                                        <CircleDollarSign className="h-2.5 w-2.5" />
                                        Invoiced
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>Customer invoice created</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-1.5 px-3 text-right text-sm">
                              {Number(entry.hours).toFixed(2)}h
                            </TableCell>
                            <TableCell className="py-1.5 px-3 text-right text-sm">
                              ${entryCost.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-1.5 px-3 text-right">
                              {isLocked ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="h-7 w-7 inline-flex items-center justify-center">
                                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Entry locked - week is closed</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(entry);
                                  }}
                                  className="h-7 w-7"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  </CollapsibleContent>
                </>
              </Collapsible>
            ))}
            {groupedEntries.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={onBulkDelete ? 8 : 7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No time entries found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
