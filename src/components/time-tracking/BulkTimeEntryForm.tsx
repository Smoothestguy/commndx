import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { usePersonnelByProject } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useBulkAddPersonnelTimeEntries } from "@/integrations/supabase/hooks/useTimeEntries";
import { toast } from "sonner";
import { Users, UserPlus, UserCheck, X } from "lucide-react";
import { startOfWeek, format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { QuickAddPersonnelDialog } from "./QuickAddPersonnelDialog";
import { PersonnelAssignmentDialog } from "./PersonnelAssignmentDialog";
import { WeekNavigator } from "./WeekNavigator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface BulkTimeEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface PersonnelWeeklyHours {
  personnelId: string;
  selected: boolean;
  hourlyRate: number;
  days: Record<DayKey, string>;
}

interface TemplateHours {
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  sun: string;
}

const DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function BulkTimeEntryForm({ open, onOpenChange }: BulkTimeEntryFormProps) {
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weeklyHours, setWeeklyHours] = useState<Map<string, PersonnelWeeklyHours>>(new Map());
  const [initialized, setInitialized] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [assignExistingOpen, setAssignExistingOpen] = useState(false);
  const [templateHours, setTemplateHours] = useState<TemplateHours>({
    mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: ""
  });

  const { data: projects = [] } = useProjects();
  const { data: assignedPersonnel = [], isLoading: loadingPersonnel, refetch: refetchPersonnel } = usePersonnelByProject(selectedProject);
  const bulkAddMutation = useBulkAddPersonnelTimeEntries();

  const activeProjects = useMemo(() => 
    projects.filter(p => p.status === "active"), 
    [projects]
  );

  // Get dates for each day of the week
  const weekDates = useMemo(() => {
    return DAYS.map((_, index) => addDays(selectedWeek, index));
  }, [selectedWeek]);

  // Reset when project changes
  useEffect(() => {
    if (selectedProject) {
      setInitialized(false);
    }
  }, [selectedProject]);

  // Initialize personnel hours map when personnel data loads
  useEffect(() => {
    if (assignedPersonnel.length > 0 && !initialized) {
      const newHoursMap = new Map<string, PersonnelWeeklyHours>();
      assignedPersonnel.forEach((assignment) => {
        if (assignment.personnel) {
          newHoursMap.set(assignment.personnel.id, {
            personnelId: assignment.personnel.id,
            selected: true, // Select all by default
            hourlyRate: assignment.personnel.hourly_rate || 0,
            days: { mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "" },
          });
        }
      });
      setWeeklyHours(newHoursMap);
      setInitialized(true);
    }
  }, [assignedPersonnel, initialized]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedProject("");
      setSelectedWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
      setWeeklyHours(new Map());
      setInitialized(false);
      setTemplateHours({ mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "" });
    }
  }, [open]);

  const applyTemplateToAll = () => {
    const hasAnyHours = Object.values(templateHours).some(h => h && parseFloat(h) > 0);
    if (!hasAnyHours) {
      toast.error("Please enter hours in at least one day");
      return;
    }

    const newMap = new Map(weeklyHours);
    let count = 0;
    weeklyHours.forEach((value, key) => {
      if (value.selected) {
        newMap.set(key, {
          ...value,
          days: { ...templateHours }
        });
        count++;
      }
    });
    setWeeklyHours(newMap);
    toast.success(`Applied template to ${count} personnel`);
  };

  const togglePersonnel = (personnelId: string) => {
    const newMap = new Map(weeklyHours);
    const current = newMap.get(personnelId);
    if (current) {
      newMap.set(personnelId, { ...current, selected: !current.selected });
    }
    setWeeklyHours(newMap);
  };

  const selectAllPersonnel = () => {
    const newMap = new Map(weeklyHours);
    weeklyHours.forEach((value, key) => {
      newMap.set(key, { ...value, selected: true });
    });
    setWeeklyHours(newMap);
  };

  const deselectAllPersonnel = () => {
    const newMap = new Map(weeklyHours);
    weeklyHours.forEach((value, key) => {
      newMap.set(key, { ...value, selected: false });
    });
    setWeeklyHours(newMap);
  };

  const updateDayHours = (personnelId: string, day: DayKey, value: string) => {
    const newMap = new Map(weeklyHours);
    const current = newMap.get(personnelId);
    if (current) {
      newMap.set(personnelId, {
        ...current,
        days: { ...current.days, [day]: value }
      });
    }
    setWeeklyHours(newMap);
  };

  const calculatePersonnelTotal = (days: Record<DayKey, string>) => {
    return DAYS.reduce((sum, day) => sum + (parseFloat(days[day]) || 0), 0);
  };

  const calculatePersonnelCost = (days: Record<DayKey, string>, hourlyRate: number) => {
    return calculatePersonnelTotal(days) * hourlyRate;
  };

  // Get selected personnel with their data
  const selectedPersonnelData = useMemo(() => {
    return Array.from(weeklyHours.entries())
      .filter(([_, data]) => data.selected)
      .map(([personnelId, data]) => {
        const assignment = assignedPersonnel.find((a) => a.personnel?.id === personnelId);
        const person = assignment?.personnel;
        return person ? {
          id: personnelId,
          firstName: person.first_name,
          lastName: person.last_name,
          hourlyRate: data.hourlyRate,
          days: data.days,
          total: calculatePersonnelTotal(data.days),
          cost: calculatePersonnelCost(data.days, data.hourlyRate)
        } : null;
      })
      .filter(Boolean) as Array<{
        id: string;
        firstName: string;
        lastName: string;
        hourlyRate: number;
        days: Record<DayKey, string>;
        total: number;
        cost: number;
      }>;
  }, [weeklyHours, assignedPersonnel]);

  // Calculate grand totals
  const grandTotalHours = selectedPersonnelData.reduce((sum, p) => sum + p.total, 0);
  const grandTotalCost = selectedPersonnelData.reduce((sum, p) => sum + p.cost, 0);

  // Check if there's any hours entered
  const hasAnyHours = selectedPersonnelData.some(p => p.total > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProject || !hasAnyHours) {
      toast.error("Please select a project and enter hours for at least one personnel");
      return;
    }

    const entries: Array<{
      personnel_id: string;
      project_id: string;
      entry_date: string;
      hours: number;
      regular_hours: number;
      overtime_hours: number;
      description: string | null;
    }> = [];

    // Create entries for each personnel/day combination
    for (const person of selectedPersonnelData) {
      // Track cumulative hours for the week to calculate overtime
      let weeklyAccumulated = 0;

      for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
        const day = DAYS[dayIndex];
        const hours = parseFloat(person.days[day]) || 0;
        
        if (hours > 0) {
          const entryDate = format(weekDates[dayIndex], "yyyy-MM-dd");
          
          // Check for existing entry
          const { data: existingEntry } = await supabase
            .from("time_entries")
            .select("id")
            .eq("project_id", selectedProject)
            .eq("personnel_id", person.id)
            .eq("entry_date", entryDate)
            .maybeSingle();

          if (existingEntry) {
            toast.error(`Entry already exists for ${person.firstName} ${person.lastName} on ${format(weekDates[dayIndex], "MMM d")}`);
            return;
          }

          // Calculate regular vs overtime
          let regularHours = hours;
          let overtimeHours = 0;
          
          const projectedTotal = weeklyAccumulated + hours;
          if (projectedTotal > 40) {
            if (weeklyAccumulated >= 40) {
              regularHours = 0;
              overtimeHours = hours;
            } else {
              regularHours = 40 - weeklyAccumulated;
              overtimeHours = hours - regularHours;
            }
          }

          weeklyAccumulated += hours;

          entries.push({
            personnel_id: person.id,
            project_id: selectedProject,
            entry_date: entryDate,
            hours,
            regular_hours: regularHours,
            overtime_hours: overtimeHours,
            description: null,
          });
        }
      }
    }

    if (entries.length === 0) {
      toast.error("No hours to log");
      return;
    }

    bulkAddMutation.mutate(entries, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Weekly Timesheet</DialogTitle>
          <DialogDescription>Log time entries for multiple team members across the week.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4">
          {/* Header Row: Project + Week Navigator */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="project">Project *</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {activeProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <WeekNavigator 
              currentWeek={selectedWeek} 
              onWeekChange={setSelectedWeek}
              showLabels={false}
            />
          </div>

          {/* Personnel Chips Section */}
          {selectedProject && assignedPersonnel.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Selected Personnel
                </Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={selectAllPersonnel}>
                    Select All
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={deselectAllPersonnel}>
                    Clear
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {assignedPersonnel
                  .filter((a): a is typeof a & { personnel: NonNullable<typeof a.personnel> } => a.personnel !== null)
                  .map((assignment) => {
                  const person = assignment.personnel;
                  const data = weeklyHours.get(person.id);
                  const selected = data?.selected || false;
                  
                  return (
                    <div
                      key={person.id}
                      onClick={() => togglePersonnel(person.id)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all ${
                        selected 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <span>{person.first_name} {person.last_name}</span>
                      <span className="text-xs opacity-80">${person.hourly_rate || 0}/hr</span>
                      {selected && <X className="h-3 w-3 opacity-60" />}
                    </div>
                  );
                })}
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  className="rounded-full"
                  onClick={() => setQuickAddOpen(true)}
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  Add
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  className="rounded-full"
                  onClick={() => setAssignExistingOpen(true)}
                >
                  <UserCheck className="h-3 w-3 mr-1" />
                  Assign
                </Button>
              </div>
            </div>
          )}

          {/* Loading / Empty States */}
          {loadingPersonnel && selectedProject && (
            <div className="py-4 text-center text-muted-foreground">Loading personnel...</div>
          )}
          {!selectedProject && (
            <div className="py-8 text-center text-muted-foreground border rounded-lg">
              Select a project to get started
            </div>
          )}
          {selectedProject && !loadingPersonnel && assignedPersonnel.length === 0 && (
            <div className="py-6 text-center border rounded-lg bg-secondary/30">
              <p className="text-muted-foreground mb-3">No personnel assigned to this project</p>
              <div className="flex justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setQuickAddOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add New Personnel
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAssignExistingOpen(true)}>
                  <UserCheck className="h-4 w-4 mr-1" />
                  Assign Existing
                </Button>
              </div>
            </div>
          )}

          {/* Quick Fill Template Row */}
          {selectedPersonnelData.length > 0 && (
            <div className="p-3 bg-secondary/30 rounded-lg border space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Quick Fill - Apply to All Selected</Label>
                <Button type="button" size="sm" onClick={applyTemplateToAll}>
                  Apply to All
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {DAYS.map((day, index) => (
                  <div key={day} className="text-center">
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={templateHours[day]}
                      onChange={(e) => setTemplateHours(prev => ({ ...prev, [day]: e.target.value }))}
                      className="h-9 text-center"
                      placeholder="0"
                    />
                    <span className="text-xs text-muted-foreground">{DAY_LABELS[index]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weekly Grid */}
          {selectedPersonnelData.length > 0 && (
            <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
              <ScrollArea className="h-full">
                <div className="min-w-[700px]">
                  {/* Header */}
                  <div className="grid grid-cols-[180px_repeat(7,1fr)_80px_100px] gap-1 p-2 bg-muted/50 border-b text-xs font-medium sticky top-0 z-10">
                    <div>Personnel</div>
                    {weekDates.map((date, index) => (
                      <div key={index} className="text-center">
                        <div>{DAY_LABELS[index]}</div>
                        <div className="text-muted-foreground font-normal">{format(date, "M/d")}</div>
                      </div>
                    ))}
                    <div className="text-center">Total</div>
                    <div className="text-center">Cost</div>
                  </div>

                  {/* Personnel Rows */}
                  {selectedPersonnelData.map((person) => (
                    <div 
                      key={person.id} 
                      className="grid grid-cols-[180px_repeat(7,1fr)_80px_100px] gap-1 p-2 border-b items-center hover:bg-muted/20"
                    >
                      <div className="text-sm truncate font-medium">
                        {person.firstName} {person.lastName}
                      </div>
                      {DAYS.map((day) => (
                        <Input
                          key={day}
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={person.days[day]}
                          onChange={(e) => updateDayHours(person.id, day, e.target.value)}
                          className="h-8 text-center text-sm px-1"
                          placeholder="0"
                        />
                      ))}
                      <div className="text-center text-sm font-medium">
                        {person.total > 0 ? `${person.total.toFixed(1)}h` : "-"}
                      </div>
                      <div className="text-center text-sm font-medium text-primary">
                        {person.cost > 0 ? `$${person.cost.toFixed(2)}` : "-"}
                      </div>
                    </div>
                  ))}

                  {/* Totals Row */}
                  <div className="grid grid-cols-[180px_repeat(7,1fr)_80px_100px] gap-1 p-2 bg-muted/30 font-medium sticky bottom-0">
                    <div className="text-sm">Totals</div>
                    {DAYS.map((day) => {
                      const dayTotal = selectedPersonnelData.reduce(
                        (sum, p) => sum + (parseFloat(p.days[day]) || 0), 
                        0
                      );
                      return (
                        <div key={day} className="text-center text-sm">
                          {dayTotal > 0 ? dayTotal.toFixed(1) : "-"}
                        </div>
                      );
                    })}
                    <div className="text-center text-sm">
                      {grandTotalHours > 0 ? `${grandTotalHours.toFixed(1)}h` : "-"}
                    </div>
                    <div className="text-center text-sm text-primary">
                      {grandTotalCost > 0 ? `$${grandTotalCost.toFixed(2)}` : "-"}
                    </div>
                  </div>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={bulkAddMutation.isPending || !hasAnyHours}
            >
              {bulkAddMutation.isPending ? "Saving..." : "Save Timesheet"}
            </Button>
          </div>
        </form>
      </DialogContent>

      {/* Quick Add Personnel Dialog */}
      <QuickAddPersonnelDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        projectId={selectedProject}
        projectName={activeProjects.find(p => p.id === selectedProject)?.name}
        onSuccess={() => {
          setInitialized(false);
          refetchPersonnel();
        }}
      />

      {/* Assign Existing Personnel Dialog */}
      <PersonnelAssignmentDialog
        open={assignExistingOpen}
        onOpenChange={setAssignExistingOpen}
        defaultProjectId={selectedProject}
        onAssignmentChange={() => {
          setInitialized(false);
          refetchPersonnel();
        }}
      />
    </Dialog>
  );
}
