import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { usePersonnelByProject } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useBulkAddPersonnelTimeEntries, usePersonnelTimeEntriesByWeek } from "@/integrations/supabase/hooks/useTimeEntries";
import { toast } from "sonner";
import { Users, UserPlus, UserCheck, X, ArrowLeft } from "lucide-react";
import { startOfWeek, format, addDays, getDay } from "date-fns";
import { QuickAddPersonnelDialog } from "@/components/time-tracking/QuickAddPersonnelDialog";
import { PersonnelAssignmentDialog } from "@/components/time-tracking/PersonnelAssignmentDialog";
import { WeekNavigator } from "@/components/time-tracking/WeekNavigator";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";

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

// Helper to convert date to day index (0 = Monday, 6 = Sunday)
const getDayIndexFromDate = (dateStr: string): number => {
  const date = new Date(dateStr + "T00:00:00");
  const jsDay = getDay(date); // 0 = Sunday, 1 = Monday, etc.
  return jsDay === 0 ? 6 : jsDay - 1; // Convert to 0 = Monday, 6 = Sunday
};

export default function TeamTimesheet() {
  const navigate = useNavigate();
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
  const { data: existingEntries = [], isLoading: loadingEntries } = usePersonnelTimeEntriesByWeek(selectedProject, selectedWeek);
  const bulkAddMutation = useBulkAddPersonnelTimeEntries();

  const activeProjects = useMemo(() => 
    projects.filter(p => p.status === "active"), 
    [projects]
  );

  // Get dates for each day of the week
  const weekDates = useMemo(() => {
    return DAYS.map((_, index) => addDays(selectedWeek, index));
  }, [selectedWeek]);

  // Reset when project OR week changes
  useEffect(() => {
    if (selectedProject) {
      setInitialized(false);
    }
  }, [selectedProject, selectedWeek]);

  // Initialize personnel hours map with existing data
  useEffect(() => {
    if (assignedPersonnel.length > 0 && !initialized && !loadingEntries) {
      const newHoursMap = new Map<string, PersonnelWeeklyHours>();
      
      assignedPersonnel.forEach((assignment) => {
        if (assignment.personnel) {
          const personnelId = assignment.personnel.id;
          
          // Find existing entries for this personnel
          const personnelEntries = existingEntries.filter(
            e => e.personnel_id === personnelId
          );
          
          // Build days object with existing hours pre-filled
          const days: Record<DayKey, string> = { mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "" };
          
          personnelEntries.forEach(entry => {
            const dayIndex = getDayIndexFromDate(entry.entry_date);
            if (dayIndex >= 0 && dayIndex < DAYS.length) {
              days[DAYS[dayIndex]] = entry.hours.toString();
            }
          });
          
          newHoursMap.set(personnelId, {
            personnelId,
            selected: true,
            hourlyRate: assignment.personnel.hourly_rate || 0,
            days,
          });
        }
      });
      
      setWeeklyHours(newHoursMap);
      setInitialized(true);
    }
  }, [assignedPersonnel, existingEntries, initialized, loadingEntries]);

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
      let weeklyAccumulated = 0;

      for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
        const day = DAYS[dayIndex];
        const hours = parseFloat(person.days[day]) || 0;
        
        if (hours > 0) {
          const entryDate = format(weekDates[dayIndex], "yyyy-MM-dd");

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
        navigate("/time-tracking");
      },
    });
  };

  return (
    <PageLayout 
      title="Team Timesheet"
      description="Log time entries for multiple team members across the week"
      actions={
        <Button variant="outline" onClick={() => navigate("/time-tracking")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Time Tracking
        </Button>
      }
    >
      <SEO 
        title="Team Timesheet - Command X"
        description="Log weekly time entries for multiple team members at once."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Row: Project + Week Navigator */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
              <div className="flex-1 space-y-2 w-full lg:max-w-md">
                <Label htmlFor="project">Project *</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-full">
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
              <div className="flex-shrink-0">
                <WeekNavigator 
                  currentWeek={selectedWeek} 
                  onWeekChange={setSelectedWeek}
                  showLabels={true}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personnel Chips Section */}
        {selectedProject && assignedPersonnel.length > 0 && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
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
                {assignedPersonnel.map((assignment) => {
                  const person = assignment.personnel;
                  if (!person) return null;
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
            </CardContent>
          </Card>
        )}

        {/* Loading / Empty States */}
        {loadingPersonnel && selectedProject && (
          <div className="py-8 text-center text-muted-foreground">Loading personnel...</div>
        )}
        {!selectedProject && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a project to get started
            </CardContent>
          </Card>
        )}
        {selectedProject && !loadingPersonnel && assignedPersonnel.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">No personnel assigned to this project</p>
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
            </CardContent>
          </Card>
        )}

        {/* Quick Fill Template Row */}
        {selectedPersonnelData.length > 0 && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-medium">Quick Fill - Apply to All Selected</Label>
                <Button type="button" size="sm" onClick={applyTemplateToAll}>
                  Apply to All
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-2 max-w-2xl">
                {DAYS.map((day, index) => (
                  <div key={day} className="text-center">
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={templateHours[day]}
                      onChange={(e) => setTemplateHours(prev => ({ ...prev, [day]: e.target.value }))}
                      className="h-10 text-center"
                      placeholder="0"
                    />
                    <span className="text-xs text-muted-foreground mt-1 block">{DAY_LABELS[index]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly Grid - Full Width */}
        {selectedPersonnelData.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-3 font-medium text-sm min-w-[200px]">Personnel</th>
                      {weekDates.map((date, index) => (
                        <th key={index} className="text-center p-3 font-medium text-sm min-w-[80px]">
                          <div>{DAY_LABELS[index]}</div>
                          <div className="text-muted-foreground font-normal text-xs">{format(date, "M/d")}</div>
                        </th>
                      ))}
                      <th className="text-center p-3 font-medium text-sm min-w-[80px]">Total</th>
                      <th className="text-center p-3 font-medium text-sm min-w-[100px]">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPersonnelData.map((person) => (
                      <tr key={person.id} className="border-b hover:bg-muted/20">
                        <td className="p-3 font-medium text-sm">
                          {person.firstName} {person.lastName}
                        </td>
                        {DAYS.map((day) => (
                          <td key={day} className="p-2">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              value={person.days[day]}
                              onChange={(e) => updateDayHours(person.id, day, e.target.value)}
                              className="h-10 text-center text-sm"
                              placeholder="0"
                            />
                          </td>
                        ))}
                        <td className="p-3 text-center text-sm font-medium">
                          {person.total > 0 ? `${person.total.toFixed(1)}h` : "-"}
                        </td>
                        <td className="p-3 text-center text-sm font-medium text-primary">
                          {person.cost > 0 ? `$${person.cost.toFixed(2)}` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-medium">
                      <td className="p-3 text-sm">Totals</td>
                      {DAYS.map((day) => {
                        const dayTotal = selectedPersonnelData.reduce(
                          (sum, p) => sum + (parseFloat(p.days[day]) || 0), 
                          0
                        );
                        return (
                          <td key={day} className="p-3 text-center text-sm">
                            {dayTotal > 0 ? dayTotal.toFixed(1) : "-"}
                          </td>
                        );
                      })}
                      <td className="p-3 text-center text-sm">
                        {grandTotalHours > 0 ? `${grandTotalHours.toFixed(1)}h` : "-"}
                      </td>
                      <td className="p-3 text-center text-sm text-primary">
                        {grandTotalCost > 0 ? `$${grandTotalCost.toFixed(2)}` : "-"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/time-tracking")}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={bulkAddMutation.isPending || !hasAnyHours}
            size="lg"
          >
            {bulkAddMutation.isPending ? "Saving..." : "Save Timesheet"}
          </Button>
        </div>
      </form>

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
    </PageLayout>
  );
}
