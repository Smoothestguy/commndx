import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Clock, CalendarSearch, DollarSign, Trash2, X } from "lucide-react";
import { TimeEntryForm } from "./TimeEntryForm";
import { QuickRateEditDialog } from "./QuickRateEditDialog";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";
import {
  TimeEntry,
  useAdminTimeEntriesByWeek,
  useBulkDeleteTimeEntries,
} from "@/integrations/supabase/hooks/useTimeEntries";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { format, addDays, startOfWeek } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
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
}

interface TimeEntryWithRelations extends TimeEntry {
  personnel?: { id: string; first_name: string; last_name: string; hourly_rate?: number | null; photo_url?: string | null } | null;
  projects?: { id: string; name: string } | null;
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

export function WeeklyTimesheet({ currentWeek, onWeekChange }: WeeklyTimesheetProps) {
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
  const isMobile = useIsMobile();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const { data: rawEntries = [], isLoading } = useAdminTimeEntriesByWeek(currentWeek);
  const entries = rawEntries as TimeEntryWithRelations[];
  const { data: companySettings } = useCompanySettings();
  const bulkDeleteMutation = useBulkDeleteTimeEntries();
  
  const overtimeMultiplier = companySettings?.overtime_multiplier || 1.5;
  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;

  // Query to find the most recent time entry date
  const { data: latestEntryDate } = useQuery({
    queryKey: ["latest-time-entry-date"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
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
          personnelRate: entry.personnel?.hourly_rate ?? null,
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
  const personnelRows = useMemo(() => 
    rows.filter(r => r.isPersonnelEntry && r.personnelId), 
    [rows]
  );

  const toggleRowSelection = (rowKey: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowKey)) {
      newSelected.delete(rowKey);
    } else {
      newSelected.add(rowKey);
    }
    setSelectedRows(newSelected);
  };

  const selectAllRows = () => {
    setSelectedRows(new Set(personnelRows.map(r => r.rowKey)));
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
      .map(entry => entry.id);

    if (entriesToDelete.length > 0) {
      await bulkDeleteMutation.mutateAsync(entriesToDelete);
      setSelectedRows(new Set());
      setShowDeleteDialog(false);
    }
  };

  // Count entries for selected rows (for confirmation message)
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
      const overtimeRatio = (totalPersonnelHours - weeklyOvertimeThreshold) / totalPersonnelHours;
      return rowTotalHours * overtimeRatio;
    }
  };

  const getRowPay = (rowKey: string, personnelId: string | null, rate: number | null) => {
    if (!rate) return null;
    const regular = getRowRegularHours(rowKey, personnelId);
    const overtime = getRowOvertimeHours(rowKey, personnelId);
    return (regular * rate) + (overtime * rate * overtimeMultiplier);
  };

  const getRowRegularPay = (rowKey: string, personnelId: string | null, rate: number | null) => {
    if (!rate) return null;
    const regular = getRowRegularHours(rowKey, personnelId);
    return regular * rate;
  };

  const getRowOvertimePay = (rowKey: string, personnelId: string | null, rate: number | null) => {
    if (!rate) return null;
    const overtime = getRowOvertimeHours(rowKey, personnelId);
    return overtime * rate * overtimeMultiplier;
  };

  // Calculate weekly totals based on per-personnel 40-hour threshold
  const weekTotal = entries.reduce((sum, e) => sum + Number(e.hours), 0);
  
  const weekTotalRegular = useMemo(() => {
    // Get unique personnel IDs
    const personnelIds = [...new Set(entries.map(e => e.personnel_id))];
    let totalRegular = 0;
    
    personnelIds.forEach(personnelId => {
      const personnelTotal = getPersonnelTotalWeeklyHours(personnelId);
      totalRegular += Math.min(personnelTotal, weeklyOvertimeThreshold);
    });
    
    return totalRegular;
  }, [entries, weeklyOvertimeThreshold]);

  const weekTotalOvertime = weekTotal - weekTotalRegular;
  
  const { weekTotalPay, weekRegularPay, weekOvertimePay } = useMemo(() => {
    let totalPay = 0;
    let regularPay = 0;
    let overtimePay = 0;
    
    rows.forEach((row) => {
      if (row.personnelRate) {
        const regular = getRowRegularHours(row.rowKey, row.personnelId ?? null);
        const overtime = getRowOvertimeHours(row.rowKey, row.personnelId ?? null);
        const regPay = regular * row.personnelRate;
        const otPay = overtime * row.personnelRate * overtimeMultiplier;
        regularPay += regPay;
        overtimePay += otPay;
        totalPay += regPay + otPay;
      }
    });
    
    return { weekTotalPay: totalPay, weekRegularPay: regularPay, weekOvertimePay: overtimePay };
  }, [rows, entries, overtimeMultiplier, weeklyOvertimeThreshold]);

  const handleJumpToRecentEntries = () => {
    if (latestEntryDate && onWeekChange) {
      onWeekChange(new Date(latestEntryDate));
    }
  };

  const latestEntryWeekStart = latestEntryDate 
    ? startOfWeek(new Date(latestEntryDate), { weekStartsOn: 1 })
    : null;
  const hasEntriesInDifferentWeek = latestEntryWeekStart && 
    latestEntryWeekStart.getTime() !== weekStart.getTime();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-full bg-muted p-3">
            <CalendarSearch className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium">No time entries for this week</p>
            <p className="text-sm text-muted-foreground">
              {hasEntriesInDifferentWeek 
                ? "You have entries in other weeks. Jump to your most recent entries or use the week navigator above."
                : "Switch to the Time Entries tab to add your first entry, or navigate to a different week."}
            </p>
          </div>
          {hasEntriesInDifferentWeek && onWeekChange && latestEntryDate && (
            <Button 
              variant="default" 
              onClick={handleJumpToRecentEntries}
              className="mt-2"
            >
              <CalendarSearch className="h-4 w-4 mr-2" />
              Jump to Week of {format(new Date(latestEntryDate), "MMM d, yyyy")}
            </Button>
          )}
        </div>
      </Card>
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
              <span className="text-lg font-bold text-primary">{weekTotal.toFixed(1)}h</span>
            </div>
            
            {/* Hours Breakdown */}
            <div className="p-2 bg-background rounded space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Hours Breakdown</p>
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="font-medium">{weekTotalRegular.toFixed(1)}h</span>
                <span className="text-muted-foreground">+</span>
                <span className="font-medium text-amber-600">{weekTotalOvertime.toFixed(1)}h</span>
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
              <p className="text-xs text-muted-foreground font-medium">Pay Breakdown ({overtimeMultiplier}x OT)</p>
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="font-medium">{formatCurrency(weekRegularPay)}</span>
                <span className="text-muted-foreground">+</span>
                <span className="font-medium text-amber-600">{formatCurrency(weekOvertimePay)}</span>
                <span className="text-muted-foreground">=</span>
                <span className="font-bold">{formatCurrency(weekTotalPay)}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Regular</span>
                <span></span>
                <span>Overtime</span>
                <span></span>
                <span>Total</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Day Cards */}
        {weekDays.map((day) => {
          const dateString = format(day, "yyyy-MM-dd");
          const dayTotal = getDayTotal(day);
          const dayEntries = entries.filter(e => e.entry_date === dateString);
          const isToday = format(new Date(), "yyyy-MM-dd") === dateString;

          return (
            <Card 
              key={dateString} 
              className={`p-3 ${isToday ? 'ring-2 ring-primary/50' : ''}`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium">{format(day, "EEEE")}</p>
                  <p className="text-sm text-muted-foreground">{format(day, "MMM d")}</p>
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
                      ? (regularHrs * row.personnelRate) + (overtimeHrs * row.personnelRate * overtimeMultiplier)
                      : null;

                    return (
                      <div
                        key={key}
                        className="p-2 bg-muted/30 rounded-lg"
                      >
                        <div 
                          className="flex items-center justify-between"
                          onClick={() => handleCellClick(row, day)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{row.projectName}</p>
                            {row.personnelName && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <PersonnelAvatar
                                  photoUrl={row.personnelPhotoUrl}
                                  firstName={row.personnelName.split(' ')[0] || ''}
                                  lastName={row.personnelName.split(' ')[1] || ''}
                                  size="xs"
                                />
                                <span>{row.personnelName}</span>
                                {row.personnelRate !== null && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1 text-xs"
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
                            <span className="font-semibold">{Number(entry.hours).toFixed(1)}h</span>
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <div className="flex gap-2">
                            <span>Reg: {regularHrs.toFixed(1)}h</span>
                            {overtimeHrs > 0 && (
                              <span className="text-amber-600">OT: {overtimeHrs.toFixed(1)}h</span>
                            )}
                          </div>
                          {pay !== null && (
                            <span className="font-medium text-foreground">{formatCurrency(pay)}</span>
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
            <p className="text-sm text-muted-foreground font-medium mb-2">Hours Breakdown</p>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold">{weekTotalRegular.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Regular</p>
              </div>
              <span className="text-2xl text-muted-foreground">+</span>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{weekTotalOvertime.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Overtime</p>
              </div>
              <span className="text-2xl text-muted-foreground">=</span>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{weekTotal.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
          
          {/* Pay Breakdown */}
          <div className="flex-1">
            <p className="text-sm text-muted-foreground font-medium mb-2">Pay Breakdown ({overtimeMultiplier}x OT)</p>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold">{formatCurrency(weekRegularPay)}</p>
                <p className="text-xs text-muted-foreground">Regular</p>
              </div>
              <span className="text-2xl text-muted-foreground">+</span>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(weekOvertimePay)}</p>
                <p className="text-xs text-muted-foreground">Overtime</p>
              </div>
              <span className="text-2xl text-muted-foreground">=</span>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{formatCurrency(weekTotalPay)}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deselectAllRows}
                >
                  <X className="h-4 w-4 mr-1" />
                  Deselect
                </Button>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Time Entries
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {personnelRows.length > 0 && (
                <th className="p-3 text-center font-medium w-12">
                  <Checkbox
                    checked={selectedRows.size === personnelRows.length && personnelRows.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        selectAllRows();
                      } else {
                        deselectAllRows();
                      }
                    }}
                  />
                </th>
              )}
              <th className="p-3 text-left font-medium min-w-[200px]">Project / Personnel</th>
              {weekDays.map((day) => (
                <th key={day.toISOString()} className="p-3 text-center font-medium min-w-[100px]">
                  <div className="text-xs text-muted-foreground">
                    {format(day, "EEE")}
                  </div>
                  <div className="text-sm">{format(day, "MMM d")}</div>
                </th>
              ))}
              <th className="p-3 text-center font-medium min-w-[200px]">Hours Breakdown</th>
              <th className="p-3 text-center font-medium min-w-[250px]">Pay Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const regularHrs = getRowRegularHours(row.rowKey, row.personnelId ?? null);
              const overtimeHrs = getRowOvertimeHours(row.rowKey, row.personnelId ?? null);
              const totalHrs = getRowTotal(row.rowKey);
              const regularPay = getRowRegularPay(row.rowKey, row.personnelId ?? null, row.personnelRate ?? null);
              const overtimePay = getRowOvertimePay(row.rowKey, row.personnelId ?? null, row.personnelRate ?? null);
              const totalPay = getRowPay(row.rowKey, row.personnelId ?? null, row.personnelRate ?? null);
              const isSelected = selectedRows.has(row.rowKey);
              const canSelect = row.isPersonnelEntry && row.personnelId;

              return (
                <tr key={row.rowKey} className={`border-b hover:bg-muted/30 ${isSelected ? 'bg-destructive/5' : ''}`}>
                  {personnelRows.length > 0 && (
                    <td className="p-3 text-center">
                      {canSelect ? (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRowSelection(row.rowKey)}
                        />
                      ) : null}
                    </td>
                  )}
                  <td className="p-3">
                    <div className="font-medium">{row.projectName}</div>
                    {row.personnelName && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <PersonnelAvatar
                          photoUrl={row.personnelPhotoUrl}
                          firstName={row.personnelName?.split(' ')[0] || ''}
                          lastName={row.personnelName?.split(' ')[1] || ''}
                          size="xs"
                        />
                        <span className="text-sm text-muted-foreground">{row.personnelName}</span>
                        {row.personnelId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1 text-xs ml-1"
                            onClick={() => handleEditRate(row)}
                          >
                            <DollarSign className="h-3 w-3" />
                            {row.personnelRate !== null ? `${row.personnelRate}/hr` : "Set rate"}
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                  {weekDays.map((day) => {
                    const dateString = format(day, "yyyy-MM-dd");
                    const key = `${row.rowKey}-${dateString}`;
                    const entry = entryMap.get(key);

                    return (
                      <td key={dateString} className="p-2 text-center">
                        <Button
                          variant={entry ? "secondary" : "ghost"}
                          size="sm"
                          className="w-full h-12 relative"
                          onClick={() => handleCellClick(row, day)}
                        >
                          {entry ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-semibold">
                                {Number(entry.hours).toFixed(2)}h
                              </span>
                              {entry.billable ? (
                                <Badge variant="default" className="h-4 text-[10px]">
                                  Bill
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="h-4 text-[10px]">
                                  Non
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </td>
                    );
                  })}
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-sm">
                      <span>{regularHrs.toFixed(2)}h</span>
                      <span className="text-muted-foreground">+</span>
                      <span className="text-amber-600">{overtimeHrs.toFixed(2)}h</span>
                      <span className="text-muted-foreground">=</span>
                      <span className="font-semibold">{totalHrs.toFixed(2)}h</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    {totalPay !== null ? (
                      <div className="flex items-center justify-center gap-1 text-sm">
                        <span>{formatCurrency(regularPay!)}</span>
                        <span className="text-muted-foreground">+</span>
                        <span className="text-amber-600">{formatCurrency(overtimePay!)}</span>
                        <span className="text-muted-foreground">=</span>
                        <span className="font-semibold">{formatCurrency(totalPay)}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-muted/50 font-semibold">
              {personnelRows.length > 0 && <td className="p-3"></td>}
              <td className="p-3">Daily Total</td>
              {weekDays.map((day) => (
                <td key={day.toISOString()} className="p-3 text-center">
                  {getDayTotal(day).toFixed(2)}h
                </td>
              ))}
              <td className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-sm">
                  <span>{weekTotalRegular.toFixed(2)}h</span>
                  <span className="text-muted-foreground font-normal">+</span>
                  <span className="text-amber-600">{weekTotalOvertime.toFixed(2)}h</span>
                  <span className="text-muted-foreground font-normal">=</span>
                  <span>{weekTotal.toFixed(2)}h</span>
                </div>
              </td>
              <td className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-sm">
                  <span>{formatCurrency(weekRegularPay)}</span>
                  <span className="text-muted-foreground font-normal">+</span>
                  <span className="text-amber-600">{formatCurrency(weekOvertimePay)}</span>
                  <span className="text-muted-foreground font-normal">=</span>
                  <span>{formatCurrency(weekTotalPay)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

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
              This will permanently delete {selectedEntriesCount} time entr{selectedEntriesCount === 1 ? 'y' : 'ies'} for the selected rows. 
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
    </div>
  );
}
