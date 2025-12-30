import { useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Pencil, Lock, Trash2, Check, X, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

interface TimeEntriesDataTableProps {
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

export function TimeEntriesDataTable({ 
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
}: TimeEntriesDataTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isMobile = useIsMobile();

  const { data: companySettings } = useCompanySettings();
  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const holidayMultiplier = companySettings?.holiday_multiplier ?? 1.5;

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

  const columns: EnhancedColumn<TimeEntryWithDetails>[] = [
    {
      key: "entry_date",
      header: "Date",
      sortable: true,
      filterable: false,
      getValue: (item) => item.entry_date,
      render: (item) => {
        const isEntryLocked = lockedEntryIds.has(item.id) || isWeekLocked;
        return (
          <div className="flex items-center gap-2">
            {isEntryLocked && (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span>{format(new Date(item.entry_date), "MMM dd, yyyy")}</span>
          </div>
        );
      },
    },
    {
      key: "personnel",
      header: "Personnel",
      sortable: true,
      filterable: true,
      getValue: (item) => getPersonnelName(item),
      render: (item) => {
        const personnelId = item.personnel_id;
        const name = getPersonnelName(item);
        return personnelId ? (
          <Link
            to={`/personnel/${personnelId}`}
            className="text-primary hover:underline font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            {name}
          </Link>
        ) : (
          <span>{name}</span>
        );
      },
    },
    {
      key: "project",
      header: "Project",
      sortable: true,
      filterable: true,
      getValue: (item) => item.projects?.name || "Unknown",
      render: (item) => {
        const project = item.projects;
        const projectId = item.project_id;
        return project && projectId ? (
          <Link
            to={`/projects/${projectId}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {project.name}
          </Link>
        ) : (
          <span className="text-muted-foreground">Unknown</span>
        );
      },
    },
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      filterable: true,
      getValue: (item) => item.projects?.customers?.name || "-",
      render: (item) => {
        const customer = item.projects?.customers;
        const customerId = item.projects?.customer_id;
        return customer && customerId ? (
          <Link
            to={`/customers/${customerId}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {customer.name}
          </Link>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      key: "hours",
      header: "Hours",
      sortable: true,
      filterable: false,
      getValue: (item) => Number(item.hours),
      render: (item) => {
        const overtime = Number(item.overtime_hours || 0);
        return (
          <div className="flex items-center gap-1.5">
            <span>{Number(item.hours).toFixed(2)}h</span>
            {overtime > 0 && (
              <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20">
                +{overtime.toFixed(1)} OT
              </Badge>
            )}
            {item.is_holiday && (
              <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
                Holiday
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "cost",
      header: "Cost",
      sortable: true,
      filterable: false,
      getValue: (item) => getEntryCost(item),
      render: (item) => (
        <span className="font-medium">${getEntryCost(item).toFixed(2)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      getValue: (item) => item.status || "pending",
      render: (item) => <StatusBadge status={getStatus(item)} />,
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      filterable: false,
      render: (item) => {
        const isLocked = lockedEntryIds.has(item.id) || isWeekLocked;
        return (
          <div className="flex items-center gap-1">
            {isLocked ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This entry is locked</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

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
              {onBulkDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {entries.map((entry) => {
            const isLocked = lockedEntryIds.has(entry.id) || isWeekLocked;
            return (
              <Card 
                key={entry.id} 
                className={`p-4 ${isLocked ? 'opacity-75 bg-muted/30' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {onBulkDelete && !isLocked && (
                      <Checkbox
                        checked={selectedIds.has(entry.id)}
                        onCheckedChange={(checked) => handleSelectOne(entry.id, !!checked)}
                      />
                    )}
                    {isLocked && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <PersonnelAvatar
                      photoUrl={entry.personnel?.photo_url}
                      firstName={entry.personnel?.first_name || ""}
                      lastName={entry.personnel?.last_name || ""}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{getPersonnelName(entry)}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {entry.projects?.name || "Unknown"}
                      </p>
                    </div>
                  </div>
                  {!isLocked && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(entry)}
                      className="shrink-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium text-sm">
                      {format(new Date(entry.entry_date), "MMM dd")}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Hours</p>
                    <p className="font-medium text-sm">{Number(entry.hours).toFixed(2)}h</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Cost</p>
                    <p className="font-medium text-sm">${getEntryCost(entry).toFixed(0)}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={getStatus(entry)} />
                  {entry.is_holiday && (
                    <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
                      Holiday
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Time Entries</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedIds.size} time entries? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Desktop Table View using EnhancedDataTable
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
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
        </div>
      )}

      <EnhancedDataTable
        tableId="time-entries"
        data={entries}
        columns={columns}
        selectable={!!onBulkDelete && !isWeekLocked}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entries</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} time entries? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
