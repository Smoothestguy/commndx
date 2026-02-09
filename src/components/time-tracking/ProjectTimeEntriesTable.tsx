import React, { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  FolderOpen,
  Folder,
  Clock,
  DollarSign,
  Check,
  X,
  FileText,
  Receipt,
  Lock,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IndeterminateCheckbox } from "@/components/ui/indeterminate-checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ComplianceBadge } from "@/components/personnel/ComplianceBadge";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useWeekCloseouts } from "@/integrations/supabase/hooks/useWeekCloseouts";
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

interface DailyEntry {
  date: string;
  entries: TimeEntryWithDetails[];
  totalHours: number;
  totalCost: number;
}

interface PersonnelGroup {
  personnelId: string;
  personnelName: string;
  personnelData: TimeEntryWithDetails["personnel"] | null;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
  totalCost: number;
  dailyEntries: DailyEntry[];
  entries: TimeEntryWithDetails[];
}

interface ProjectGroup {
  projectId: string;
  projectName: string;
  customerName: string;
  totalHours: number;
  totalCost: number;
  personnelGroups: PersonnelGroup[];
  entries: TimeEntryWithDetails[];
  isLocked: boolean;
  invoiceStatus: 'invoiced' | 'partial' | 'uninvoiced';
}

interface ProjectTimeEntriesTableProps {
  entries: TimeEntryWithDetails[];
  weekStart: Date;
  onEdit: (entry: TimeEntryWithDetails) => void;
  onBulkDelete?: (ids: string[]) => void;
  onStatusChange?: (ids: string[], status: string) => void;
  onCreateVendorBill?: (entries: TimeEntryWithDetails[]) => void;
  onCreateCustomerInvoice?: (entries: TimeEntryWithDetails[]) => void;
  onBulkCreateInvoices?: (entries: TimeEntryWithDetails[]) => void;
  isDeleting?: boolean;
  isUpdatingStatus?: boolean;
}

const getComplianceData = (personnel: TimeEntryWithDetails["personnel"]) => {
  if (!personnel) return null;
  return {
    everify_status: personnel.everify_status,
    everify_expiry: personnel.everify_expiry,
    work_auth_expiry: personnel.work_auth_expiry,
    i9_completed_at: personnel.i9_completed_at,
  };
};

export function ProjectTimeEntriesTable({
  entries,
  weekStart,
  onEdit,
  onBulkDelete,
  onStatusChange,
  onCreateVendorBill,
  onCreateCustomerInvoice,
  onBulkCreateInvoices,
  isDeleting,
  isUpdatingStatus,
}: ProjectTimeEntriesTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );
  const [expandedPersonnel, setExpandedPersonnel] = useState<Set<string>>(
    new Set()
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isMobile = useIsMobile();

  const { data: companySettings } = useCompanySettings();
  const { data: weekCloseouts = [] } = useWeekCloseouts(weekStart);

  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const holidayMultiplier = companySettings?.holiday_multiplier ?? 2.0;
  const weeklyOvertimeThreshold =
    companySettings?.weekly_overtime_threshold ?? 40;

  // Create a map of closed projects
  const closedProjectIds = useMemo(() => {
    return new Set(
      weekCloseouts
        .filter((wc) => wc.status === "closed")
        .map((wc) => wc.project_id)
    );
  }, [weekCloseouts]);

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
    // Use || to fall back when rate is 0 (not just null/undefined)
    return (
      entry.hourly_rate ||
      entry.personnel?.hourly_rate ||
      entry.profiles?.hourly_rate ||
      0
    );
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

  // Group entries hierarchically: Project → Personnel → Daily
  const projectGroups = useMemo(() => {
    const projects = new Map<string, ProjectGroup>();

    entries.forEach((entry) => {
      const projectId = entry.project_id;
      const projectName = entry.projects?.name || "Unknown Project";
      const customerName = entry.projects?.customers?.name || "-";

      if (!projects.has(projectId)) {
        projects.set(projectId, {
          projectId,
          projectName,
          customerName,
          totalHours: 0,
          totalCost: 0,
          personnelGroups: [],
          entries: [],
          isLocked: closedProjectIds.has(projectId),
          invoiceStatus: 'uninvoiced',
        });
      }

      projects.get(projectId)!.entries.push(entry);
    });

    // Now group by personnel within each project
    projects.forEach((project) => {
      const personnelMap = new Map<string, PersonnelGroup>();

      project.entries.forEach((entry) => {
        const personnelId = entry.personnel_id || entry.user_id;
        const personnelName = getPersonnelName(entry);

        if (!personnelMap.has(personnelId)) {
          personnelMap.set(personnelId, {
            personnelId,
            personnelName,
            personnelData: entry.personnel || null,
            totalHours: 0,
            regularHours: 0,
            overtimeHours: 0,
            holidayHours: 0,
            totalCost: 0,
            dailyEntries: [],
            entries: [],
          });
        }

        const personnel = personnelMap.get(personnelId)!;
        personnel.totalHours += Number(entry.hours);
        if (entry.is_holiday) {
          personnel.holidayHours += Number(entry.hours);
        }
        personnel.entries.push(entry);
      });

      // Calculate costs and group by day for each personnel
      personnelMap.forEach((personnel) => {
        // Calculate weekly overtime on non-holiday hours only
        const nonHolidayHours = personnel.totalHours - personnel.holidayHours;
        personnel.regularHours = Math.min(
          nonHolidayHours,
          weeklyOvertimeThreshold
        );
        personnel.overtimeHours = Math.max(
          0,
          nonHolidayHours - weeklyOvertimeThreshold
        );

        const hourlyRate = personnel.entries[0]
          ? getHourlyRate(personnel.entries[0])
          : 0;
        const regularCost = personnel.regularHours * hourlyRate;
        const overtimeCost =
          personnel.overtimeHours * hourlyRate * overtimeMultiplier;
        // Holiday hours get full multiplier (e.g., 2x), not added to regular/OT
        const holidayCost =
          personnel.holidayHours * hourlyRate * holidayMultiplier;
        personnel.totalCost = regularCost + overtimeCost + holidayCost;

        // Group entries by date
        const dailyMap = new Map<string, DailyEntry>();
        personnel.entries.forEach((entry) => {
          const date = entry.entry_date;
          if (!dailyMap.has(date)) {
            dailyMap.set(date, {
              date,
              entries: [],
              totalHours: 0,
              totalCost: 0,
            });
          }
          const daily = dailyMap.get(date)!;
          daily.entries.push(entry);
          daily.totalHours += Number(entry.hours);

          const entryHourlyRate = getHourlyRate(entry);
          const entryHours = Number(entry.hours);
          let cost;
          if (entry.is_holiday) {
            // Holiday entries: full hours × rate × holiday multiplier
            cost = entryHours * entryHourlyRate * holidayMultiplier;
          } else {
            // Non-holiday: regular calculation (OT handled at weekly level)
            const regular = Number(entry.regular_hours || entry.hours);
            const overtime = Number(entry.overtime_hours || 0);
            cost =
              regular * entryHourlyRate +
              overtime * entryHourlyRate * overtimeMultiplier;
          }
          daily.totalCost += cost;
        });

        personnel.dailyEntries = Array.from(dailyMap.values()).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        project.totalHours += personnel.totalHours;
        project.totalCost += personnel.totalCost;
      });

      project.personnelGroups = Array.from(personnelMap.values()).sort((a, b) =>
        a.personnelName.localeCompare(b.personnelName)
      );

      // Calculate invoice status
      const invoicedCount = project.entries.filter(e => e.invoice_id).length;
      const totalCount = project.entries.length;
      project.invoiceStatus = totalCount === 0
        ? 'uninvoiced'
        : invoicedCount === totalCount
          ? 'invoiced'
          : invoicedCount > 0
            ? 'partial'
            : 'uninvoiced';
    });

    return Array.from(projects.values()).sort((a, b) =>
      a.projectName.localeCompare(b.projectName)
    );
  }, [
    entries,
    closedProjectIds,
    weeklyOvertimeThreshold,
    overtimeMultiplier,
    holidayMultiplier,
  ]);

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const togglePersonnel = (key: string) => {
    const newExpanded = new Set(expandedPersonnel);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedPersonnel(newExpanded);
  };

  const handleSelectProject = (project: ProjectGroup, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    project.entries.forEach((entry) => {
      if (checked) {
        newSelection.add(entry.id);
      } else {
        newSelection.delete(entry.id);
      }
    });
    setSelectedIds(newSelection);
  };

  const handleSelectPersonnel = (
    personnel: PersonnelGroup,
    checked: boolean
  ) => {
    const newSelection = new Set(selectedIds);
    personnel.entries.forEach((entry) => {
      if (checked) {
        newSelection.add(entry.id);
      } else {
        newSelection.delete(entry.id);
      }
    });
    setSelectedIds(newSelection);
  };

  const handleSelectEntry = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedIds(newSelection);
  };

  const isProjectSelected = (project: ProjectGroup) => {
    return (
      project.entries.length > 0 &&
      project.entries.every((e) => selectedIds.has(e.id))
    );
  };

  const isProjectIndeterminate = (project: ProjectGroup) => {
    const selectedCount = project.entries.filter((e) =>
      selectedIds.has(e.id)
    ).length;
    return selectedCount > 0 && selectedCount < project.entries.length;
  };

  const isPersonnelSelected = (personnel: PersonnelGroup) => {
    return (
      personnel.entries.length > 0 &&
      personnel.entries.every((e) => selectedIds.has(e.id))
    );
  };

  const isPersonnelIndeterminate = (personnel: PersonnelGroup) => {
    const selectedCount = personnel.entries.filter((e) =>
      selectedIds.has(e.id)
    ).length;
    return selectedCount > 0 && selectedCount < personnel.entries.length;
  };

  const handleConfirmDelete = () => {
    if (onBulkDelete && selectedIds.size > 0) {
      onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
    setShowDeleteDialog(false);
  };

  // Check if any selected entries can be approved/rejected
  const selectedEntryList = entries.filter((e) => selectedIds.has(e.id));
  const hasApprovableEntries = selectedEntryList.some(
    (e) => e.status !== "approved"
  );
  const hasRejectableEntries = selectedEntryList.some(
    (e) => e.status !== "rejected"
  );

  if (projectGroups.length === 0) {
    return (
      <div className="text-center py-12">
        <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No time entries for this week</p>
      </div>
    );
  }

  // Mobile Bulk Actions Bar Component
  const MobileBulkActions = () => {
    if (selectedIds.size === 0) return null;

    return (
      <div className="glass rounded-lg border border-border/50 p-3 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="h-8 px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {onStatusChange && hasApprovableEntries && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onStatusChange(Array.from(selectedIds), "approved");
                setSelectedIds(new Set());
              }}
              disabled={isUpdatingStatus}
              className="text-green-600 border-green-600/30 hover:bg-green-600/10 h-11"
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
          )}
          {onStatusChange && hasRejectableEntries && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onStatusChange(Array.from(selectedIds), "rejected");
                setSelectedIds(new Set());
              }}
              disabled={isUpdatingStatus}
              className="text-red-600 border-red-600/30 hover:bg-red-600/10 h-11"
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          )}
          {onCreateVendorBill && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selectedEntryList = entries.filter((e) =>
                  selectedIds.has(e.id)
                );
                onCreateVendorBill(selectedEntryList);
              }}
              className="text-blue-600 border-blue-600/30 hover:bg-blue-600/10 h-11"
            >
              <FileText className="h-4 w-4 mr-1" />
              Bill
            </Button>
          )}
          {onCreateCustomerInvoice && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selectedEntryList = entries.filter((e) =>
                  selectedIds.has(e.id)
                );
                onCreateCustomerInvoice(selectedEntryList);
              }}
              className="text-green-600 border-green-600/30 hover:bg-green-600/10 h-11"
            >
              <Receipt className="h-4 w-4 mr-1" />
              Invoice
            </Button>
          )}
          {onBulkCreateInvoices && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selectedEntryList = entries.filter((e) =>
                  selectedIds.has(e.id)
                );
                onBulkCreateInvoices(selectedEntryList);
              }}
              className="text-purple-600 border-purple-600/30 hover:bg-purple-600/10 h-11"
            >
              <Users className="h-4 w-4 mr-1" />
              Bulk Invoice
            </Button>
          )}
          {onBulkDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              className="h-11 col-span-2"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Selected
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Mobile Card-based View
  if (isMobile) {
    return (
      <>
        <MobileBulkActions />

        <div className="space-y-3">
          {projectGroups.map((project) => (
            <Collapsible
              key={project.projectId}
              open={expandedProjects.has(project.projectId)}
              onOpenChange={() => toggleProject(project.projectId)}
            >
              {/* Project Card */}
              <Card className="glass overflow-hidden">
                <CollapsibleTrigger asChild>
                  <div className="p-4 flex items-start gap-3 cursor-pointer active:bg-muted/50 transition-colors">
                    {onBulkDelete && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="pt-0.5"
                      >
                        <IndeterminateCheckbox
                          checked={isProjectSelected(project)}
                          indeterminate={isProjectIndeterminate(project)}
                          onCheckedChange={(checked) =>
                            handleSelectProject(project, !!checked)
                          }
                          className="h-5 w-5"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {expandedProjects.has(project.projectId) ? (
                          <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                        ) : (
                          <Folder className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-semibold truncate">
                          {project.projectName}
                        </span>
                        {project.isLocked && (
                          <Lock className="h-4 w-4 text-orange-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate mb-2">
                        {project.customerName}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {project.totalHours.toFixed(1)}h
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            ${project.totalCost.toFixed(2)}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {project.personnelGroups.length} personnel
                        </Badge>
                        {project.invoiceStatus === 'invoiced' ? (
                          <Badge className="text-xs bg-success/10 text-success border-success/20 border">
                            <Check className="h-3 w-3 mr-1" />
                            Invoiced
                          </Badge>
                        ) : project.invoiceStatus === 'partial' ? (
                          <Badge className="text-xs bg-warning/10 text-warning border-warning/20 border">
                            Partially Invoiced
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20 border">
                            Uninvoiced
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 pt-1">
                      {expandedProjects.has(project.projectId) ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t border-border/50">
                    {project.personnelGroups.map((personnel) => {
                      const personnelKey = `${project.projectId}-${personnel.personnelId}`;
                      return (
                        <Collapsible
                          key={personnelKey}
                          open={expandedPersonnel.has(personnelKey)}
                          onOpenChange={() => togglePersonnel(personnelKey)}
                        >
                          {/* Personnel Row */}
                          <CollapsibleTrigger asChild>
                            <div className="p-3 pl-6 flex items-start gap-3 cursor-pointer active:bg-muted/30 transition-colors bg-muted/20 border-b border-border/30">
                              {onBulkDelete && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="pt-0.5"
                                >
                                  <IndeterminateCheckbox
                                    checked={isPersonnelSelected(personnel)}
                                    indeterminate={isPersonnelIndeterminate(personnel)}
                                    onCheckedChange={(checked) =>
                                      handleSelectPersonnel(
                                        personnel,
                                        !!checked
                                      )
                                    }
                                    className="h-5 w-5"
                                  />
                                </div>
                              )}
                              <PersonnelAvatar
                                photoUrl={personnel.personnelData?.photo_url}
                                firstName={
                                  personnel.personnelData?.first_name || ""
                                }
                                lastName={
                                  personnel.personnelData?.last_name || ""
                                }
                                size="sm"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium truncate">
                                    {personnel.personnelName}
                                  </span>
                                  <ComplianceBadge
                                    personnel={getComplianceData(
                                      personnel.personnelData
                                    )}
                                    compact
                                  />
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="font-medium">
                                    {personnel.totalHours.toFixed(1)}h
                                  </span>
                                  {personnel.overtimeHours > 0 && (
                                    <span className="text-orange-500 text-xs">
                                      +{personnel.overtimeHours.toFixed(1)}h OT
                                    </span>
                                  )}
                                  <span className="text-muted-foreground">
                                    ${personnel.totalCost.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0 pt-1">
                                <Badge
                                  variant="outline"
                                  className="text-xs mr-2"
                                >
                                  {personnel.dailyEntries.length}d
                                </Badge>
                                {expandedPersonnel.has(personnelKey) ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground inline" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            {/* Daily Entries */}
                            {personnel.dailyEntries.map((daily) =>
                              daily.entries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="p-3 pl-10 flex items-start gap-3 bg-background border-b border-border/20 last:border-b-0"
                                >
                                  {onBulkDelete && (
                                    <Checkbox
                                      checked={selectedIds.has(entry.id)}
                                      onCheckedChange={(checked) =>
                                        handleSelectEntry(entry.id, !!checked)
                                      }
                                      className="h-5 w-5 mt-0.5"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-sm">
                                        {format(
                                          parseISO(entry.entry_date),
                                          "EEE, MMM d"
                                        )}
                                      </span>
                                      {entry.is_holiday && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20"
                                        >
                                          Holiday
                                        </Badge>
                                      )}
                                      <StatusBadge status={getStatus(entry)} />
                                    </div>
                                    {entry.description && (
                                      <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
                                        {entry.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-3 text-sm">
                                      <span className="font-medium">
                                        {Number(entry.hours).toFixed(2)}h
                                      </span>
                                      <span className="text-muted-foreground">
                                        $
                                        {(
                                          Number(entry.hours) *
                                          getHourlyRate(entry) *
                                          (entry.is_holiday
                                            ? holidayMultiplier
                                            : 1)
                                        ).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 shrink-0"
                                    onClick={() => onEdit(entry)}
                                    disabled={project.isLocked}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Time Entries</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedIds.size} time{" "}
                {selectedIds.size === 1 ? "entry" : "entries"}? This action
                cannot be undone.
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
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {onStatusChange && hasApprovableEntries && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onStatusChange(Array.from(selectedIds), "approved");
                  setSelectedIds(new Set());
                }}
                disabled={isUpdatingStatus}
                className="text-green-600 border-green-600/30 hover:bg-green-600/10"
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
            )}
            {onStatusChange && hasRejectableEntries && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onStatusChange(Array.from(selectedIds), "rejected");
                  setSelectedIds(new Set());
                }}
                disabled={isUpdatingStatus}
                className="text-red-600 border-red-600/30 hover:bg-red-600/10"
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
            )}
            {onCreateVendorBill && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const selectedEntryList = entries.filter((e) =>
                    selectedIds.has(e.id)
                  );
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
                  const selectedEntryList = entries.filter((e) =>
                    selectedIds.has(e.id)
                  );
                  onCreateCustomerInvoice(selectedEntryList);
                }}
                className="text-green-600 border-green-600/30 hover:bg-green-600/10"
              >
                <Receipt className="h-4 w-4 mr-1" />
                Invoice Customer
              </Button>
            )}
            {onBulkCreateInvoices && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const selectedEntryList = entries.filter((e) =>
                    selectedIds.has(e.id)
                  );
                  onBulkCreateInvoices(selectedEntryList);
                }}
                className="text-purple-600 border-purple-600/30 hover:bg-purple-600/10"
              >
                <Users className="h-4 w-4 mr-1" />
                Bulk Invoice
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

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {onBulkDelete && <TableHead className="w-12"></TableHead>}
              <TableHead className="min-w-[300px]">
                Project / Personnel / Entry
              </TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectGroups.map((project) => (
              <React.Fragment key={project.projectId}>
                {/* Project Row (Level 1) */}
                <TableRow
                  className="bg-muted/50 hover:bg-muted/70 cursor-pointer font-medium"
                  onClick={() => toggleProject(project.projectId)}
                >
                  {onBulkDelete && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <IndeterminateCheckbox
                        checked={isProjectSelected(project)}
                        indeterminate={isProjectIndeterminate(project)}
                        onCheckedChange={(checked) =>
                          handleSelectProject(project, !!checked)
                        }
                        aria-label={`Select all entries for ${project.projectName}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {expandedProjects.has(project.projectId) ? (
                        <FolderOpen className="h-5 w-5 text-primary" />
                      ) : (
                        <Folder className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="font-semibold">
                        {project.projectName}
                      </span>
                      {project.isLocked && (
                        <Badge
                          variant="outline"
                          className="bg-orange-500/10 text-orange-500 border-orange-500/20 gap-1 ml-2"
                        >
                          <Lock className="h-3 w-3" />
                          Locked
                        </Badge>
                      )}
                      <Badge variant="secondary" className="ml-2">
                        {project.personnelGroups.length} personnel
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.customerName}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <div className="flex items-center justify-end gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {project.totalHours.toFixed(1)}h
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <div className="flex items-center justify-end gap-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />$
                      {project.totalCost.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {project.invoiceStatus === 'invoiced' ? (
                      <Badge className="text-xs bg-success/10 text-success border-success/20 border">
                        <Check className="h-3 w-3 mr-1" />
                        Invoiced
                      </Badge>
                    ) : project.invoiceStatus === 'partial' ? (
                      <Badge className="text-xs bg-warning/10 text-warning border-warning/20 border">
                        Partially Invoiced
                      </Badge>
                    ) : (
                      <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20 border">
                        Uninvoiced
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      {expandedProjects.has(project.projectId) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>

                {/* Personnel Rows (Level 2) */}
                {expandedProjects.has(project.projectId) &&
                  project.personnelGroups.map((personnel) => {
                    const personnelKey = `${project.projectId}-${personnel.personnelId}`;
                    return (
                      <React.Fragment key={personnelKey}>
                        <TableRow
                          className="bg-muted/30 hover:bg-muted/50 cursor-pointer"
                          onClick={() => togglePersonnel(personnelKey)}
                        >
                          {onBulkDelete && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <IndeterminateCheckbox
                                checked={isPersonnelSelected(personnel)}
                                indeterminate={isPersonnelIndeterminate(personnel)}
                                onCheckedChange={(checked) =>
                                  handleSelectPersonnel(personnel, !!checked)
                                }
                                aria-label={`Select all entries for ${personnel.personnelName}`}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-3 pl-8">
                              <PersonnelAvatar
                                photoUrl={personnel.personnelData?.photo_url}
                                firstName={
                                  personnel.personnelData?.first_name || ""
                                }
                                lastName={
                                  personnel.personnelData?.last_name || ""
                                }
                                size="sm"
                              />
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {personnel.personnelName}
                                </span>
                                <ComplianceBadge
                                  personnel={getComplianceData(
                                    personnel.personnelData
                                  )}
                                  compact
                                />
                              </div>
                              <Badge variant="outline" className="ml-2">
                                {personnel.dailyEntries.length} days
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right">
                            <div className="space-y-0.5">
                              <div className="font-medium">
                                {personnel.totalHours.toFixed(1)}h
                              </div>
                              {personnel.overtimeHours > 0 && (
                                <div className="text-xs text-orange-500">
                                  +{personnel.overtimeHours.toFixed(1)}h OT
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${personnel.totalCost.toFixed(2)}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              {expandedPersonnel.has(personnelKey) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Daily Entry Rows (Level 3) */}
                        {expandedPersonnel.has(personnelKey) &&
                          personnel.dailyEntries.map((daily) => (
                            <React.Fragment key={daily.date}>
                              {daily.entries.map((entry) => (
                                <TableRow
                                  key={entry.id}
                                  className="bg-background hover:bg-muted/20"
                                >
                                  {onBulkDelete && (
                                    <TableCell>
                                      <Checkbox
                                        checked={selectedIds.has(entry.id)}
                                        onCheckedChange={(checked) =>
                                          handleSelectEntry(entry.id, !!checked)
                                        }
                                        aria-label={`Select entry`}
                                      />
                                    </TableCell>
                                  )}
                                  <TableCell>
                                    <div className="flex items-center gap-3 pl-16">
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {format(
                                            parseISO(entry.entry_date),
                                            "EEE, MMM d"
                                          )}
                                        </span>
                                        {entry.description && (
                                          <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                                            {entry.description}
                                          </span>
                                        )}
                                      </div>
                                      {entry.is_holiday && (
                                        <Badge
                                          variant="outline"
                                          className="bg-purple-500/10 text-purple-500 border-purple-500/20"
                                        >
                                          Holiday
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell></TableCell>
                                  <TableCell className="text-right">
                                    {Number(entry.hours).toFixed(2)}h
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    $
                                    {(
                                      Number(entry.hours) *
                                      getHourlyRate(entry) *
                                      (entry.is_holiday ? holidayMultiplier : 1)
                                    ).toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <StatusBadge status={getStatus(entry)} />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => onEdit(entry)}
                                        disabled={project.isLocked}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      {onBulkDelete && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-destructive hover:text-destructive"
                                          onClick={() => {
                                            setSelectedIds(new Set([entry.id]));
                                            setShowDeleteDialog(true);
                                          }}
                                          disabled={project.isLocked}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          ))}
                      </React.Fragment>
                    );
                  })}
              </React.Fragment>
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
              Are you sure you want to delete {selectedIds.size} time{" "}
              {selectedIds.size === 1 ? "entry" : "entries"}? This action cannot
              be undone.
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
