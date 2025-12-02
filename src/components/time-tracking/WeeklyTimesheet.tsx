import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Lock, Edit } from "lucide-react";
import { TimeEntryForm } from "./TimeEntryForm";
import {
  TimeEntry,
  useTimeEntriesByWeek,
  useDeleteTimeEntry,
  useAssignedProjects,
} from "@/integrations/supabase/hooks/useTimeEntries";
import { format, addDays, startOfWeek } from "date-fns";

interface WeeklyTimesheetProps {
  currentWeek: Date;
}

export function WeeklyTimesheet({ currentWeek }: WeeklyTimesheetProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const { data: entries = [], isLoading } = useTimeEntriesByWeek(currentWeek);
  const { data: projects = [] } = useAssignedProjects();

  // Get all days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Get unique projects that have entries this week
  const projectsWithEntries = useMemo(() => {
    const projectIds = new Set(entries.map((e) => e.project_id));
    return projects.filter((p) => projectIds.has(p.id));
  }, [entries, projects]);

  // Create a map of entries by project and date
  const entryMap = useMemo(() => {
    const map = new Map<string, TimeEntry>();
    entries.forEach((entry) => {
      const key = `${entry.project_id}-${entry.entry_date}`;
      map.set(key, entry);
    });
    return map;
  }, [entries]);

  const handleCellClick = (projectId: string, date: Date) => {
    const dateString = format(date, "yyyy-MM-dd");
    const key = `${projectId}-${dateString}`;
    const existingEntry = entryMap.get(key);

    if (existingEntry) {
      setEditingEntry(existingEntry);
    } else {
      setSelectedProjectId(projectId);
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

  const getProjectTotal = (projectId: string) => {
    return entries
      .filter((e) => e.project_id === projectId)
      .reduce((sum, e) => sum + Number(e.hours), 0);
  };

  const weekTotal = entries.reduce((sum, e) => sum + Number(e.hours), 0);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  if (projectsWithEntries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No time entries for this week yet.</p>
        <p className="text-sm text-muted-foreground">
          Switch to Daily view to add your first entry.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left font-medium min-w-[150px]">Project</th>
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
            {projectsWithEntries.map((project) => (
              <tr key={project.id} className="border-b hover:bg-muted/30">
                <td className="p-3 font-medium">{project.name}</td>
                {weekDays.map((day) => {
                  const dateString = format(day, "yyyy-MM-dd");
                  const key = `${project.id}-${dateString}`;
                  const entry = entryMap.get(key);

                  return (
                    <td key={dateString} className="p-2 text-center">
                      <Button
                        variant={entry ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full h-12 relative"
                        onClick={() => handleCellClick(project.id, day)}
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
                  {getProjectTotal(project.id).toFixed(2)}h
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
