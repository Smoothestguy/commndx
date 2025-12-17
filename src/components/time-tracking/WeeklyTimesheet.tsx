import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Clock, User, CalendarSearch } from "lucide-react";
import { TimeEntryForm } from "./TimeEntryForm";
import {
  TimeEntry,
  useAdminTimeEntriesByWeek,
} from "@/integrations/supabase/hooks/useTimeEntries";
import { format, addDays, startOfWeek } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface WeeklyTimesheetProps {
  currentWeek: Date;
  onWeekChange?: (date: Date) => void;
}

interface TimeEntryWithRelations extends TimeEntry {
  personnel?: { id: string; first_name: string; last_name: string } | null;
  projects?: { id: string; name: string } | null;
}

interface RowData {
  rowKey: string;
  projectId: string;
  projectName: string;
  personnelId?: string | null;
  personnelName?: string;
  isPersonnelEntry: boolean;
}

export function WeeklyTimesheet({ currentWeek, onWeekChange }: WeeklyTimesheetProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const isMobile = useIsMobile();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const { data: rawEntries = [], isLoading } = useAdminTimeEntriesByWeek(currentWeek);
  const entries = rawEntries as TimeEntryWithRelations[];

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
          isPersonnelEntry,
        });
      }
    });
    
    return Array.from(rowMap.values()).sort((a, b) => {
      // Sort by project name first, then by personnel name
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

  const getDayTotal = (date: Date) => {
    const dateString = format(date, "yyyy-MM-dd");
    return entries
      .filter((e) => e.entry_date === dateString)
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

  const weekTotal = entries.reduce((sum, e) => sum + Number(e.hours), 0);

  const handleJumpToRecentEntries = () => {
    if (latestEntryDate && onWeekChange) {
      onWeekChange(new Date(latestEntryDate));
    }
  };

  // Check if the latest entry is in a different week
  const latestEntryWeekStart = latestEntryDate 
    ? startOfWeek(new Date(latestEntryDate), { weekStartsOn: 1 })
    : null;
  const hasEntriesInDifferentWeek = latestEntryWeekStart && 
    latestEntryWeekStart.getTime() !== weekStart.getTime();

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium">Week Total</span>
            </div>
            <span className="text-lg font-bold text-primary">{weekTotal.toFixed(1)}h</span>
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

                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                        onClick={() => handleCellClick(row, day)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{row.projectName}</p>
                          {row.personnelName && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {row.personnelName}
                            </p>
                          )}
                          <Badge 
                            variant={entry.billable ? "default" : "secondary"} 
                            className="text-xs mt-1"
                          >
                            {entry.billable ? "Billable" : "Non-billable"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{Number(entry.hours).toFixed(1)}h</span>
                          <Edit className="h-4 w-4 text-muted-foreground" />
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
      </div>
    );
  }

  // Desktop: Table view
  return (
    <div className="space-y-4">
      <Card className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left font-medium min-w-[200px]">Project / Personnel</th>
              {weekDays.map((day) => (
                <th key={day.toISOString()} className="p-3 text-center font-medium min-w-[100px]">
                  <div className="text-xs text-muted-foreground">
                    {format(day, "EEE")}
                  </div>
                  <div className="text-sm">{format(day, "MMM d")}</div>
                </th>
              ))}
              <th className="p-3 text-center font-medium min-w-[80px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowKey} className="border-b hover:bg-muted/30">
                <td className="p-3">
                  <div className="font-medium">{row.projectName}</div>
                  {row.personnelName && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <User className="h-3 w-3" />
                      {row.personnelName}
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
                <td className="p-3 text-center font-semibold">
                  {getRowTotal(row.rowKey).toFixed(2)}h
                </td>
              </tr>
            ))}
            <tr className="bg-muted/50 font-semibold">
              <td className="p-3">Daily Total</td>
              {weekDays.map((day) => (
                <td key={day.toISOString()} className="p-3 text-center">
                  {getDayTotal(day).toFixed(2)}h
                </td>
              ))}
              <td className="p-3 text-center">{weekTotal.toFixed(2)}h</td>
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
    </div>
  );
}
