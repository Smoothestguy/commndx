import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit,
  Clock,
  CalendarSearch,
  DollarSign,
  Trash2,
  X,
  Loader2,
  Download,
  FileSpreadsheet,
  FileText,
  FileJson,
  FileType,
  Lock,
  Folder,
  FileCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TimeEntryForm } from "./TimeEntryForm";
import { WeeklyProjectSection } from "./WeeklyProjectSection";
import { toast } from "sonner";
import {
  exportTimeEntriesToExcel,
  exportTimeEntriesToPDF,
  exportTimeEntriesToJSON,
  exportTimeEntriesToCSV,
  type TimeEntryExportData,
} from "@/utils/timeEntryExportUtils";
import { ExportColumnsDialog } from "./ExportColumnsDialog";
import { QuickRateEditDialog } from "./QuickRateEditDialog";
import { WH347ExportDialog } from "./WH347ExportDialog";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";
import {
  TimeEntry,
  useAdminTimeEntriesByWeek,
  useBulkDeleteTimeEntries,
  useAssignedProjects,
} from "@/integrations/supabase/hooks/useTimeEntries";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useWeekCloseout } from "@/integrations/supabase/hooks/useWeekCloseouts";
import { format, addDays, startOfWeek } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { useUserRole } from "@/hooks/useUserRole";
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

interface WeeklyTimesheetProps {
  currentWeek: Date;
  onWeekChange?: (date: Date) => void;
  projectFilter?: string;
}

interface TimeEntryWithRelations extends TimeEntry {
  hourly_rate?: number | null;
  personnel?: {
    id: string;
    first_name: string;
    last_name: string;
    hourly_rate?: number | null;
    photo_url?: string | null;
  } | null;
  projects?: { id: string; name: string } | null;
  is_locked?: boolean;
}

interface RowData {
  rowKey: string;
  projectId: string;
  projectName: string;
  personnelId?: string | null;
  personnelName?: string;
  personnelRate?: number | null;
  personnelPhotoUrl?: string | null;
  isPersonnelEntry: boolean;
}

export function WeeklyTimesheet({
  currentWeek,
  onWeekChange,
  projectFilter,
}: WeeklyTimesheetProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<{
    id: string;
    name: string;
    rate: number;
  } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [pendingExportFormat, setPendingExportFormat] = useState<"excel" | "pdf" | "csv" | "json" | null>(null);
  const [exportSelectedOnly, setExportSelectedOnly] = useState(false);
  const [wh347DialogOpen, setWH347DialogOpen] = useState(false);
  
  
  // Track which project folders are expanded
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  
  const isMobile = useIsMobile();

  // Get user role to determine if we should show all entries
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const showAllEntries = isAdmin || isManager;

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const { data: rawEntries = [], isLoading: entriesLoading } =
    useAdminTimeEntriesByWeek(currentWeek, {
      showAllEntries: showAllEntries && !roleLoading,
    });
  
  // Filter entries by project if projectFilter is set
  const filteredEntries = useMemo(() => {
    if (!projectFilter) return rawEntries as TimeEntryWithRelations[];
    return (rawEntries as TimeEntryWithRelations[]).filter(e => e.project_id === projectFilter);
  }, [rawEntries, projectFilter]);
  
  const entries = filteredEntries;

  // Check if the week is closed for the selected project
  const { data: weekCloseout } = useWeekCloseout(projectFilter, currentWeek);
  const isWeekClosed = weekCloseout?.status === 'closed';

  const isLoading = roleLoading || entriesLoading;
  const { data: companySettings } = useCompanySettings();
  const bulkDeleteMutation = useBulkDeleteTimeEntries();
  const { data: assignedProjects = [] } = useAssignedProjects();
  const { data: allProjects = [] } = useProjects();
  

  const overtimeMultiplier = companySettings?.overtime_multiplier || 1.5;
  const holidayMultiplier = companySettings?.holiday_multiplier || 2.0;
  const weeklyOvertimeThreshold =
    companySettings?.weekly_overtime_threshold ?? 40;

  // Query to find the most recent time entry date
  const { data: latestEntryDate } = useQuery({
    queryKey: ["latest-time-entry-date"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("time_entries")
        .select("entry_date")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: false })
        .limit(1);

      return data?.[0]?.entry_date || null;
    },
  });

  // Get all days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Get unique rows (project + optional personnel combination)
  const rows = useMemo(() => {
    const rowMap = new Map<string, RowData>();

    entries.forEach((entry) => {
      const isPersonnelEntry = !!entry.personnel_id;
      const rowKey = isPersonnelEntry
        ? `${entry.project_id}-${entry.personnel_id}`
        : `${entry.project_id}-self`;

      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, {
          rowKey,
          projectId: entry.project_id,
          projectName: entry.projects?.name || "Unknown Project",
          personnelId: entry.personnel_id,
          personnelName: entry.personnel
            ? `${entry.personnel.first_name} ${entry.personnel.last_name}`
            : undefined,
          personnelRate: entry.hourly_rate || entry.personnel?.hourly_rate || null,
          personnelPhotoUrl: entry.personnel?.photo_url ?? null,
          isPersonnelEntry,
        });
      }
    });

    return Array.from(rowMap.values()).sort((a, b) => {
      const projectCompare = a.projectName.localeCompare(b.projectName);
      if (projectCompare !== 0) return projectCompare;
      if (!a.personnelName) return -1;
      if (!b.personnelName) return 1;
      return a.personnelName.localeCompare(b.personnelName);
    });
  }, [entries]);

  // Group rows by project for hierarchical display
  const rowsByProject = useMemo(() => {
    const grouped = new Map<string, { projectId: string; projectName: string; rows: RowData[] }>();
    
    rows.forEach((row) => {
      if (!grouped.has(row.projectId)) {
        grouped.set(row.projectId, {
          projectId: row.projectId,
          projectName: row.projectName,
          rows: [],
        });
      }
      grouped.get(row.projectId)!.rows.push(row);
    });
    
    return Array.from(grouped.values()).sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [rows]);

  // Projects start collapsed - user can expand as needed

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  // Create a map of entries by rowKey and date
  const entryMap = useMemo(() => {
    const map = new Map<string, TimeEntryWithRelations>();
    entries.forEach((entry) => {
      const rowKey = entry.personnel_id
        ? `${entry.project_id}-${entry.personnel_id}`
        : `${entry.project_id}-self`;
      const key = `${rowKey}-${entry.entry_date}`;
      map.set(key, entry);
    });
    return map;
  }, [entries]);

  const handleCellClick = (row: RowData, date: Date) => {
    const dateString = format(date, "yyyy-MM-dd");
    const key = `${row.rowKey}-${dateString}`;
    const existingEntry = entryMap.get(key);

    // Check if the entry or week is locked
    if (existingEntry?.is_locked || isWeekClosed) {
      toast.error("This week is closed. Cannot edit entries.");
      return;
    }

    if (existingEntry) {
      setEditingEntry(existingEntry);
    } else {
      setSelectedProjectId(row.projectId);
      setSelectedDate(dateString);
      setEditingEntry(null);
    }
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingEntry(null);
    setSelectedDate("");
    setSelectedProjectId("");
  };

  const handleEditRate = (row: RowData) => {
    if (row.personnelId && row.personnelName) {
      setSelectedPersonnel({
        id: row.personnelId,
        name: row.personnelName,
        rate: row.personnelRate ?? 0,
      });
      setRateDialogOpen(true);
    }
  };

  // Selection handlers for bulk delete
  const personnelRows = useMemo(
    () => rows.filter((r) => r.isPersonnelEntry && r.personnelId),
    [rows]
  );

  const toggleRowSelection = (rowKey: string) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowKey)) {
        newSet.delete(rowKey);
      } else {
        newSet.add(rowKey);
      }
      return newSet;
    });
  };

  const selectProjectRows = (rowKeys: string[], selected: boolean) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        rowKeys.forEach((key) => newSet.add(key));
      } else {
        rowKeys.forEach((key) => newSet.delete(key));
      }
      return newSet;
    });
  };

  const selectAllRows = () => {
    setSelectedRows(new Set(personnelRows.map((r) => r.rowKey)));
  };

  const deselectAllRows = () => {
    setSelectedRows(new Set());
  };

  const handleBulkDelete = async () => {
    // Get all time entry IDs for selected rows
    const entriesToDelete = entries
      .filter((entry) => {
        const rowKey = entry.personnel_id
          ? `${entry.project_id}-${entry.personnel_id}`
          : `${entry.project_id}-self`;
        return selectedRows.has(rowKey);
      })
      .map((entry) => entry.id);

    if (entriesToDelete.length > 0) {
      await bulkDeleteMutation.mutateAsync(entriesToDelete);
      setSelectedRows(new Set());
      setShowDeleteDialog(false);
    }
  };

  // Get all projects for folder view (including those with entries)
  const allProjectsForFolders = useMemo(() => {
    const projectsList = (isAdmin || isManager) ? allProjects : assignedProjects;
    return projectsList;
  }, [isAdmin, isManager, allProjects, assignedProjects]);

  // Filter out projects that already have entries for the current week (to avoid duplicates)
  const availableProjects = useMemo(() => {
    // For admin/manager, use all projects; for regular users, use assigned projects
    const projectsList = (isAdmin || isManager) ? allProjects : assignedProjects;
    
    const projectsWithEntries = new Set(
      entries
        .filter((e) => !e.personnel_id) // Only check self-entries
        .map((e) => e.project_id)
    );
    return projectsList.filter((p) => !projectsWithEntries.has(p.id));
  }, [isAdmin, isManager, allProjects, assignedProjects, entries]);

  const selectedEntriesCount = useMemo(() => {
    return entries.filter((entry) => {
      const rowKey = entry.personnel_id
        ? `${entry.project_id}-${entry.personnel_id}`
        : `${entry.project_id}-self`;
      return selectedRows.has(rowKey);
    }).length;
  }, [entries, selectedRows]);

  const getDayTotal = (date: Date) => {
    const dateString = format(date, "yyyy-MM-dd");
    return entries
      .filter((e) => e.entry_date === dateString)
      .reduce((sum, e) => sum + Number(e.hours), 0);
  };

  // Get total hours for a personnel across ALL projects for the week
  const getPersonnelTotalWeeklyHours = (personnelId: string | null) => {
    return entries
      .filter((e) => e.personnel_id === personnelId)
      .reduce((sum, e) => sum + Number(e.hours), 0);
  };

  const getRowTotal = (rowKey: string) => {
    return entries
      .filter((e) => {
        const entryRowKey = e.personnel_id
          ? `${e.project_id}-${e.personnel_id}`
          : `${e.project_id}-self`;
        return entryRowKey === rowKey;
      })
      .reduce((sum, e) => sum + Number(e.hours), 0);
  };

  // Get holiday hours for a row
  const getRowHolidayHours = (rowKey: string) => {
    return entries
      .filter((e) => {
        const entryRowKey = e.personnel_id
          ? `${e.project_id}-${e.personnel_id}`
          : `${e.project_id}-self`;
        return entryRowKey === rowKey && (e as any).is_holiday === true;
      })
      .reduce((sum, e) => sum + Number(e.hours), 0);
  };

  // Calculate regular hours based on weekly 40-hour threshold
  const getRowRegularHours = (rowKey: string, personnelId: string | null) => {
    const totalPersonnelHours = getPersonnelTotalWeeklyHours(personnelId);
    const rowTotalHours = getRowTotal(rowKey);

    if (totalPersonnelHours <= weeklyOvertimeThreshold) {
      // All hours are regular
      return rowTotalHours;
    } else {
      // Proportionally distribute regular hours across this row
      const regularRatio = weeklyOvertimeThreshold / totalPersonnelHours;
      return rowTotalHours * regularRatio;
    }
  };

  // Calculate overtime hours based on weekly 40-hour threshold
  const getRowOvertimeHours = (rowKey: string, personnelId: string | null) => {
    const totalPersonnelHours = getPersonnelTotalWeeklyHours(personnelId);
    const rowTotalHours = getRowTotal(rowKey);

    if (totalPersonnelHours <= weeklyOvertimeThreshold) {
      // No overtime
      return 0;
    } else {
      // Proportionally distribute overtime across this row
      const overtimeRatio =
        (totalPersonnelHours - weeklyOvertimeThreshold) / totalPersonnelHours;
      return rowTotalHours * overtimeRatio;
    }
  };

  const getRowPay = (
    rowKey: string,
    personnelId: string | null,
    rate: number | null
  ) => {
    if (!rate) return null;
    const regular = getRowRegularHours(rowKey, personnelId);
    const overtime = getRowOvertimeHours(rowKey, personnelId);
    const holiday = getRowHolidayHours(rowKey);
    
    // Holiday hours are paid at full holiday rate, separate from regular/OT
    // Regular and OT are calculated on non-holiday hours
    const nonHolidayHours = getRowTotal(rowKey) - holiday;
    const adjustedRegular = Math.min(nonHolidayHours, regular);
    const adjustedOvertime = Math.max(0, nonHolidayHours - adjustedRegular);
    
    return adjustedRegular * rate + adjustedOvertime * rate * overtimeMultiplier + holiday * rate * holidayMultiplier;
  };

  const getRowHolidayPay = (
    rowKey: string,
    rate: number | null
  ) => {
    if (!rate) return null;
    const holiday = getRowHolidayHours(rowKey);
    return holiday * rate * holidayMultiplier;
  };

  const getRowRegularPay = (
    rowKey: string,
    personnelId: string | null,
    rate: number | null
  ) => {
    if (!rate) return null;
    const regular = getRowRegularHours(rowKey, personnelId);
    return regular * rate;
  };

  const getRowOvertimePay = (
    rowKey: string,
    personnelId: string | null,
    rate: number | null
  ) => {
    if (!rate) return null;
    const overtime = getRowOvertimeHours(rowKey, personnelId);
    return overtime * rate * overtimeMultiplier;
  };

  // Calculate weekly totals based on per-personnel 40-hour threshold
  const weekTotal = entries.reduce((sum, e) => sum + Number(e.hours), 0);

  // Calculate total holiday hours
  const weekTotalHoliday = useMemo(() => {
    return entries
      .filter((e) => (e as any).is_holiday === true)
      .reduce((sum, e) => sum + Number(e.hours), 0);
  }, [entries]);

  const weekTotalRegular = useMemo(() => {
    // Get unique personnel IDs
    const personnelIds = [...new Set(entries.map((e) => e.personnel_id))];
    let totalRegular = 0;

    personnelIds.forEach((personnelId) => {
      const personnelTotal = getPersonnelTotalWeeklyHours(personnelId);
      // Subtract holiday hours from this personnel's total for regular/OT calculation
      const personnelHoliday = entries
        .filter((e) => e.personnel_id === personnelId && (e as any).is_holiday === true)
        .reduce((sum, e) => sum + Number(e.hours), 0);
      const nonHolidayTotal = personnelTotal - personnelHoliday;
      totalRegular += Math.min(nonHolidayTotal, weeklyOvertimeThreshold);
    });

    return totalRegular;
  }, [entries, weeklyOvertimeThreshold]);

  const weekTotalOvertime = weekTotal - weekTotalRegular - weekTotalHoliday;

  const { weekTotalPay, weekRegularPay, weekOvertimePay, weekHolidayPay } = useMemo(() => {
    let totalPay = 0;
    let regularPay = 0;
    let overtimePay = 0;
    let holidayPay = 0;

    rows.forEach((row) => {
      if (row.personnelRate) {
        const rowHolidayHrs = getRowHolidayHours(row.rowKey);
        const rowTotalHrs = getRowTotal(row.rowKey);
        const nonHolidayHrs = rowTotalHrs - rowHolidayHrs;
        
        // Calculate regular/OT based on non-holiday hours
        const personnelTotal = getPersonnelTotalWeeklyHours(row.personnelId ?? null);
        const personnelHoliday = entries
          .filter((e) => e.personnel_id === row.personnelId && (e as any).is_holiday === true)
          .reduce((sum, e) => sum + Number(e.hours), 0);
        const personnelNonHoliday = personnelTotal - personnelHoliday;
        
        const regularRatio = personnelNonHoliday <= weeklyOvertimeThreshold 
          ? 1 
          : weeklyOvertimeThreshold / personnelNonHoliday;
        const overtimeRatio = personnelNonHoliday <= weeklyOvertimeThreshold 
          ? 0 
          : (personnelNonHoliday - weeklyOvertimeThreshold) / personnelNonHoliday;
        
        const regular = nonHolidayHrs * regularRatio;
        const overtime = nonHolidayHrs * overtimeRatio;
        
        const regPay = regular * row.personnelRate;
        const otPay = overtime * row.personnelRate * overtimeMultiplier;
        const holPay = rowHolidayHrs * row.personnelRate * holidayMultiplier;
        
        regularPay += regPay;
        overtimePay += otPay;
        holidayPay += holPay;
        totalPay += regPay + otPay + holPay;
      }
    });

    return {
      weekTotalPay: totalPay,
      weekRegularPay: regularPay,
      weekOvertimePay: overtimePay,
      weekHolidayPay: holidayPay,
    };
  }, [rows, entries, overtimeMultiplier, holidayMultiplier, weeklyOvertimeThreshold]);

  const handleJumpToRecentEntries = () => {
    if (latestEntryDate && onWeekChange) {
      onWeekChange(new Date(latestEntryDate));
    }
  };

  // Open the export column dialog
  const handleOpenExportDialog = (
    exportFormat: "excel" | "pdf" | "json" | "csv",
    selectedOnly: boolean = false
  ) => {
    if (selectedOnly) {
      const selectedEntries = entries.filter((entry) => {
        const rowKey = entry.personnel_id
          ? `${entry.project_id}-${entry.personnel_id}`
          : entry.project_id;
        return selectedRows.has(rowKey);
      });
      if (selectedEntries.length === 0) {
        toast.error("No time entries found for selected rows");
        return;
      }
    } else if (entries.length === 0) {
      toast.error("No time entries to export for this week");
      return;
    }

    setPendingExportFormat(exportFormat);
    setExportSelectedOnly(selectedOnly);
    setExportDialogOpen(true);
  };

  // Execute the export with selected columns
  const handleExportWithColumns = async (visibleColumns: string[]) => {
    if (!pendingExportFormat) return;

    const entriesToExport = exportSelectedOnly
      ? entries.filter((entry) => {
          const rowKey = entry.personnel_id
            ? `${entry.project_id}-${entry.personnel_id}`
            : entry.project_id;
          return selectedRows.has(rowKey);
        })
      : entries;

    if (entriesToExport.length === 0) {
      toast.error("No time entries to export");
      return;
    }

    setIsExporting(true);
    try {
      const exportData: TimeEntryExportData = {
        entries: entriesToExport as any,
        weekStart,
        weekEnd,
        overtimeMultiplier,
        weeklyOvertimeThreshold,
        visibleColumns,
      };

      const weekLabel = `${format(weekStart, "MMM-d")}-to-${format(
        weekEnd,
        "MMM-d-yyyy"
      )}`;
      const filenamePrefix = exportSelectedOnly ? "timesheet-selected" : "timesheet";

      switch (pendingExportFormat) {
        case "excel":
          await exportTimeEntriesToExcel(exportData, `${filenamePrefix}-${weekLabel}`);
          toast.success("Excel file downloaded successfully");
          break;
        case "pdf":
          exportTimeEntriesToPDF(exportData, `${filenamePrefix}-${weekLabel}`);
          toast.success("PDF file downloaded successfully");
          break;
        case "csv":
          exportTimeEntriesToCSV(exportData, `${filenamePrefix}-${weekLabel}`);
          toast.success("CSV file downloaded successfully");
          break;
        case "json":
          exportTimeEntriesToJSON(exportData, `${filenamePrefix}-${weekLabel}`);
          toast.success("JSON file downloaded successfully");
          break;
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export time entries");
    } finally {
      setIsExporting(false);
      setPendingExportFormat(null);
      setExportSelectedOnly(false);
    }
  };

  const latestEntryWeekStart = latestEntryDate
    ? startOfWeek(new Date(latestEntryDate), { weekStartsOn: 1 })
    : null;
  const hasEntriesInDifferentWeek =
    latestEntryWeekStart &&
    latestEntryWeekStart.getTime() !== weekStart.getTime();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };


  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Loading...</div>
    );
  }



  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        {/* Jump to recent entries hint */}
        {hasEntriesInDifferentWeek && onWeekChange && latestEntryDate && (
          <Card className="p-4 bg-muted/30 border-muted">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                You have entries in other weeks. Jump to your most recent entries.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleJumpToRecentEntries}
              >
                <CalendarSearch className="h-4 w-4 mr-2" />
                Jump to Week of {format(new Date(latestEntryDate), "MMM d, yyyy")}
              </Button>
            </div>
          </Card>
        )}


        {!isWeekClosed && allProjectsForFolders.length === 0 && (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-muted p-3">
                <CalendarSearch className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium">No projects available</p>
                <p className="text-sm text-muted-foreground">
                  Contact your administrator to be assigned to projects.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // Mobile: Stacked day-by-day view
  if (isMobile) {
    return (
      <div className="w-full max-w-full overflow-hidden space-y-3">
        {/* Weekly Total Card */}
        <Card className="p-3 bg-primary/5 border-primary/20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-medium">Week Total</span>
              </div>
              <span className="text-lg font-bold text-primary">
                {weekTotal.toFixed(1)}h
              </span>
            </div>

            {/* Hours Breakdown */}
            <div className="p-2 bg-background rounded space-y-1">
              <p className="text-xs text-muted-foreground font-medium">
                Hours Breakdown
              </p>
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="font-medium">
                  {weekTotalRegular.toFixed(1)}h
                </span>
                <span className="text-muted-foreground">+</span>
                <span className="font-medium text-amber-600">
                  {weekTotalOvertime.toFixed(1)}h
                </span>
                <span className="text-muted-foreground">=</span>
                <span className="font-bold">{weekTotal.toFixed(1)}h</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Regular</span>
                <span></span>
                <span>Overtime</span>
                <span></span>
                <span>Total</span>
              </div>
            </div>

            {/* Pay Breakdown */}
            <div className="p-2 bg-background rounded space-y-1">
              <p className="text-xs text-muted-foreground font-medium">
                Pay Breakdown ({overtimeMultiplier}x OT)
              </p>
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="font-medium">
                  {formatCurrency(weekRegularPay)}
                </span>
                <span className="text-muted-foreground">+</span>
                <span className="font-medium text-amber-600">
                  {formatCurrency(weekOvertimePay)}
                </span>
                <span className="text-muted-foreground">=</span>
                <span className="font-bold">
                  {formatCurrency(weekTotalPay)}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Regular</span>
                <span></span>
                <span>Overtime</span>
                <span></span>
                <span>Total</span>
              </div>
            </div>

            {/* Export Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isExporting || entries.length === 0}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export Week
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48">
                <DropdownMenuItem onClick={() => handleOpenExportDialog("excel")}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export to Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenExportDialog("csv")}>
                  <FileType className="h-4 w-4 mr-2" />
                  Export to CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenExportDialog("pdf")}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export to PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenExportDialog("json")}>
                  <FileJson className="h-4 w-4 mr-2" />
                  Export to JSON
                </DropdownMenuItem>
                {(isAdmin || isManager) && projectFilter && (
                  <>
                    <div className="h-px bg-border my-1" />
                    <DropdownMenuItem onClick={() => setWH347DialogOpen(true)}>
                      <FileCheck className="h-4 w-4 mr-2" />
                      Export WH-347
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>

        {/* Day Cards */}
        {weekDays.map((day) => {
          const dateString = format(day, "yyyy-MM-dd");
          const dayTotal = getDayTotal(day);
          const dayEntries = entries.filter((e) => e.entry_date === dateString);
          const isToday = format(new Date(), "yyyy-MM-dd") === dateString;

          return (
            <Card
              key={dateString}
              className={`p-3 ${isToday ? "ring-2 ring-primary/50" : ""}`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium">{format(day, "EEEE")}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(day, "MMM d")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{dayTotal.toFixed(1)}h</p>
                </div>
              </div>

              {/* Day Entries */}
              {dayEntries.length > 0 ? (
                <div className="space-y-2 mt-3 pt-3 border-t border-border/30">
                  {rows.map((row) => {
                    const key = `${row.rowKey}-${dateString}`;
                    const entry = entryMap.get(key);
                    if (!entry) return null;

                    const regularHrs = Number(entry.regular_hours || 0);
                    const overtimeHrs = Number(entry.overtime_hours || 0);
                    const pay = row.personnelRate
                      ? regularHrs * row.personnelRate +
                        overtimeHrs * row.personnelRate * overtimeMultiplier
                      : null;

                    return (
                      <div 
                        key={key} 
                        className={`p-3 rounded-lg ${
                          entry.is_locked || isWeekClosed 
                            ? "bg-muted/50 opacity-75" 
                            : "bg-muted/30"
                        }`}
                      >
                        <div
                          className={`flex items-center justify-between min-h-[44px] ${
                            entry.is_locked || isWeekClosed ? "cursor-not-allowed" : "cursor-pointer active:bg-muted/50"
                          }`}
                          onClick={() => handleCellClick(row, day)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {row.projectName}
                            </p>
                            {row.personnelName && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <PersonnelAvatar
                                  photoUrl={row.personnelPhotoUrl}
                                  firstName={
                                    row.personnelName.split(" ")[0] || ""
                                  }
                                  lastName={
                                    row.personnelName.split(" ")[1] || ""
                                  }
                                  size="xs"
                                />
                                <span>{row.personnelName}</span>
                                {row.personnelRate !== null && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditRate(row);
                                    }}
                                  >
                                    <DollarSign className="h-3 w-3" />
                                    {row.personnelRate}/hr
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {Number(entry.hours).toFixed(2)}h
                            </span>
                            {entry.is_locked || isWeekClosed ? (
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Edit className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <div className="flex gap-2">
                            <span>Reg: {regularHrs.toFixed(1)}h</span>
                            {overtimeHrs > 0 && (
                              <span className="text-amber-600">
                                OT: {overtimeHrs.toFixed(1)}h
                              </span>
                            )}
                          </div>
                          {pay !== null && (
                            <span className="font-medium text-foreground">
                              {formatCurrency(pay)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-border/30">
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No entries
                  </p>
                </div>
              )}
            </Card>
          );
        })}
        

        <TimeEntryForm
          open={formOpen}
          onOpenChange={handleFormClose}
          entry={editingEntry}
          defaultDate={selectedDate}
          defaultProjectId={selectedProjectId}
        />

        {selectedPersonnel && (
          <QuickRateEditDialog
            open={rateDialogOpen}
            onOpenChange={setRateDialogOpen}
            personnelId={selectedPersonnel.id}
            personnelName={selectedPersonnel.name}
            currentRate={selectedPersonnel.rate}
          />
        )}
      </div>
    );
  }

  // Desktop: Table view
  return (
    <div className="space-y-4">
      {/* Weekly Summary Card */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Hours Breakdown */}
          <div className="flex-1">
            <p className="text-sm text-muted-foreground font-medium mb-2">
              Hours Breakdown
            </p>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {weekTotalRegular.toFixed(1)}h
                </p>
                <p className="text-xs text-muted-foreground">Regular</p>
              </div>
              <span className="text-2xl text-muted-foreground">+</span>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {weekTotalOvertime.toFixed(1)}h
                </p>
                <p className="text-xs text-muted-foreground">Overtime</p>
              </div>
              <span className="text-2xl text-muted-foreground">=</span>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {weekTotal.toFixed(1)}h
                </p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </div>

          {/* Pay Breakdown */}
          <div className="flex-1">
            <p className="text-sm text-muted-foreground font-medium mb-2">
              Pay Breakdown ({overtimeMultiplier}x OT)
            </p>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {formatCurrency(weekRegularPay)}
                </p>
                <p className="text-xs text-muted-foreground">Regular</p>
              </div>
              <span className="text-2xl text-muted-foreground">+</span>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {formatCurrency(weekOvertimePay)}
                </p>
                <p className="text-xs text-muted-foreground">Overtime</p>
              </div>
              <span className="text-2xl text-muted-foreground">=</span>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(weekTotalPay)}
                </p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isExporting || entries.length === 0}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export Week
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleOpenExportDialog("excel")}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export to Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenExportDialog("csv")}>
                  <FileType className="h-4 w-4 mr-2" />
                  Export to CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenExportDialog("pdf")}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export to PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenExportDialog("json")}>
                  <FileJson className="h-4 w-4 mr-2" />
                  Export to JSON
                </DropdownMenuItem>
                {(isAdmin || isManager) && projectFilter && (
                  <>
                    <div className="h-px bg-border my-1" />
                    <DropdownMenuItem onClick={() => setWH347DialogOpen(true)}>
                      <FileCheck className="h-4 w-4 mr-2" />
                      Export WH-347 Certified Payroll
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      {/* Bulk Action Bar */}
      {selectedRows.size > 0 && (
        <Card className="p-3 bg-destructive/5 border-destructive/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedRows.size} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllRows}
                  disabled={selectedRows.size === personnelRows.length}
                >
                  Select All ({personnelRows.length})
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAllRows}>
                  <X className="h-4 w-4 mr-1" />
                  Deselect
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isExporting}>
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export Selected
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleOpenExportDialog("excel", true)}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export to Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenExportDialog("csv", true)}>
                    <FileType className="h-4 w-4 mr-2" />
                    Export to CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenExportDialog("pdf", true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export to PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleOpenExportDialog("json", true)}
                  >
                    <FileJson className="h-4 w-4 mr-2" />
                    Export to JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Time Entries
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Project Sections - Each project is a collapsible folder */}
      <div className="space-y-4">
        {rowsByProject.map((projectGroup) => (
          <WeeklyProjectSection
            key={projectGroup.projectId}
            projectId={projectGroup.projectId}
            projectName={projectGroup.projectName}
            rows={projectGroup.rows}
            weekDays={weekDays}
            entries={entries}
            entryMap={entryMap}
            isExpanded={expandedProjects.has(projectGroup.projectId)}
            onToggleExpand={() => toggleProjectExpanded(projectGroup.projectId)}
            isWeekClosed={isWeekClosed}
            selectedRows={selectedRows}
            onToggleRowSelection={toggleRowSelection}
            onSelectProjectRows={selectProjectRows}
            onCellClick={handleCellClick}
            onEditRate={handleEditRate}
            getRowTotal={getRowTotal}
            getRowRegularHours={getRowRegularHours}
            getRowOvertimeHours={getRowOvertimeHours}
            getRowRegularPay={getRowRegularPay}
            getRowOvertimePay={getRowOvertimePay}
            getRowPay={getRowPay}
            overtimeMultiplier={overtimeMultiplier}
            weeklyOvertimeThreshold={weeklyOvertimeThreshold}
            formatCurrency={formatCurrency}
            hasPersonnelRows={personnelRows.length > 0}
          />
        ))}

        {/* Grand Totals Card */}
        {rowsByProject.length > 1 && (
          <Card className="p-4 bg-muted/30 border-muted">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-semibold text-lg">Grand Total ({rowsByProject.length} Projects)</span>
              </div>
              <div className="flex items-center gap-6">
                {/* Hours Summary */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{weekTotalRegular.toFixed(1)}h</span>
                  <span className="text-muted-foreground">+</span>
                  <span className="text-amber-600 font-medium">{weekTotalOvertime.toFixed(1)}h OT</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="font-bold text-primary text-lg">{weekTotal.toFixed(1)}h</span>
                </div>
                {/* Pay Summary */}
                {weekTotalPay > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-bold text-lg">{formatCurrency(weekTotalPay)}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      <TimeEntryForm
        open={formOpen}
        onOpenChange={handleFormClose}
        entry={editingEntry}
        defaultDate={selectedDate}
        defaultProjectId={selectedProjectId}
      />

      {selectedPersonnel && (
        <QuickRateEditDialog
          open={rateDialogOpen}
          onOpenChange={setRateDialogOpen}
          personnelId={selectedPersonnel.id}
          personnelName={selectedPersonnel.name}
          currentRate={selectedPersonnel.rate}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entries?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedEntriesCount} time entr
              {selectedEntriesCount === 1 ? "y" : "ies"} for the selected rows.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Columns Dialog */}
      <ExportColumnsDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        exportFormat={pendingExportFormat}
        onConfirm={handleExportWithColumns}
      />

      {/* WH-347 Export Dialog */}
      {projectFilter && (
        <WH347ExportDialog
          open={wh347DialogOpen}
          onOpenChange={setWH347DialogOpen}
          entries={entries}
          weekStart={weekStart}
          projectId={projectFilter}
          projectName={rowsByProject.find(p => p.projectId === projectFilter)?.projectName}
        />
      )}
    </div>
  );
}
