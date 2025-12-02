import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { usePersonnelByProject } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useBulkAddPersonnelTimeEntries } from "@/integrations/supabase/hooks/useTimeEntries";
import { toast } from "sonner";
import { Users, ChevronDown, ChevronRight, UserPlus, UserCheck } from "lucide-react";
import { startOfWeek, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { QuickAddPersonnelDialog } from "./QuickAddPersonnelDialog";
import { PersonnelAssignmentDialog } from "./PersonnelAssignmentDialog";

interface BulkTimeEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PersonnelHours {
  personnelId: string;
  selected: boolean;
  hours: string;
  notes: string;
}

export function BulkTimeEntryForm({ open, onOpenChange }: BulkTimeEntryFormProps) {
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [personnelHours, setPersonnelHours] = useState<Map<string, PersonnelHours>>(new Map());
  const [expandedPersonnel, setExpandedPersonnel] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [assignExistingOpen, setAssignExistingOpen] = useState(false);

  const { data: projects = [] } = useProjects();
  const { data: assignedPersonnel = [], isLoading: loadingPersonnel, refetch: refetchPersonnel } = usePersonnelByProject(selectedProject);
  const bulkAddMutation = useBulkAddPersonnelTimeEntries();

  const activeProjects = useMemo(() => 
    projects.filter(p => p.status === "active"), 
    [projects]
  );

  // Reset when project changes
  useEffect(() => {
    if (selectedProject) {
      setInitialized(false);
      setExpandedPersonnel(new Set());
    }
  }, [selectedProject]);

  // Initialize personnel hours map when personnel data loads
  useEffect(() => {
    if (assignedPersonnel.length > 0 && !initialized) {
      const newHoursMap = new Map<string, PersonnelHours>();
      assignedPersonnel.forEach((assignment) => {
        if (assignment.personnel) {
          newHoursMap.set(assignment.personnel.id, {
            personnelId: assignment.personnel.id,
            selected: false,
            hours: "",
            notes: "",
          });
        }
      });
      setPersonnelHours(newHoursMap);
      setInitialized(true);
    }
  }, [assignedPersonnel, initialized]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedProject("");
      setSelectedDate(new Date().toISOString().split("T")[0]);
      setPersonnelHours(new Map());
      setExpandedPersonnel(new Set());
      setInitialized(false);
    }
  }, [open]);

  const togglePersonnel = (personnelId: string) => {
    const newMap = new Map(personnelHours);
    const current = newMap.get(personnelId);
    if (current) {
      newMap.set(personnelId, { ...current, selected: !current.selected });
    }
    setPersonnelHours(newMap);
  };

  const selectAllPersonnel = () => {
    const newMap = new Map(personnelHours);
    personnelHours.forEach((value, key) => {
      newMap.set(key, { ...value, selected: true });
    });
    setPersonnelHours(newMap);
  };

  const deselectAllPersonnel = () => {
    const newMap = new Map(personnelHours);
    personnelHours.forEach((value, key) => {
      newMap.set(key, { ...value, selected: false });
    });
    setPersonnelHours(newMap);
  };

  const updateHours = (personnelId: string, hours: string) => {
    const newMap = new Map(personnelHours);
    const current = newMap.get(personnelId);
    if (current) {
      newMap.set(personnelId, { ...current, hours });
    }
    setPersonnelHours(newMap);
  };

  const updateNotes = (personnelId: string, notes: string) => {
    const newMap = new Map(personnelHours);
    const current = newMap.get(personnelId);
    if (current) {
      newMap.set(personnelId, { ...current, notes });
    }
    setPersonnelHours(newMap);
  };

  const toggleExpanded = (personnelId: string) => {
    const newExpanded = new Set(expandedPersonnel);
    if (newExpanded.has(personnelId)) {
      newExpanded.delete(personnelId);
    } else {
      newExpanded.add(personnelId);
    }
    setExpandedPersonnel(newExpanded);
  };

  const selectedPersonnelList = useMemo(() => {
    return Array.from(personnelHours.entries())
      .filter(([_, data]) => data.selected && parseFloat(data.hours) > 0)
      .map(([id, data]) => {
        const assignment = assignedPersonnel.find((a) => a.personnel?.id === id);
        const person = assignment?.personnel;
        return person ? { 
          ...person, 
          hours: parseFloat(data.hours), 
          notes: data.notes,
          hourly_rate: person.hourly_rate || 0
        } : null;
      })
      .filter(Boolean) as Array<{
        id: string;
        first_name: string;
        last_name: string;
        hourly_rate: number;
        hours: number;
        notes: string;
      }>;
  }, [personnelHours, assignedPersonnel]);

  const totalHours = selectedPersonnelList.reduce((sum, p) => sum + p.hours, 0);
  const totalCost = selectedPersonnelList.reduce((sum, p) => sum + (p.hours * p.hourly_rate), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProject || selectedPersonnelList.length === 0) {
      toast.error("Please select a project and at least one personnel with hours");
      return;
    }

    // Check for existing entries
    const { data: existingEntries, error: checkError } = await supabase
      .from("time_entries")
      .select("personnel_id")
      .eq("project_id", selectedProject)
      .eq("entry_date", selectedDate)
      .in("personnel_id", selectedPersonnelList.map(p => p.id));

    if (checkError) {
      toast.error("Failed to check for existing entries");
      return;
    }

    if (existingEntries && existingEntries.length > 0) {
      const duplicateNames = selectedPersonnelList
        .filter(p => existingEntries.some(e => e.personnel_id === p.id))
        .map(p => `${p.first_name} ${p.last_name}`)
        .join(", ");
      toast.error(`Time already logged for ${duplicateNames} on this date`);
      return;
    }

    // Calculate overtime based on weekly hours
    const weekStart = startOfWeek(new Date(selectedDate), { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekEndStr = format(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

    const entries: Array<{
      personnel_id: string;
      project_id: string;
      entry_date: string;
      hours: number;
      regular_hours: number;
      overtime_hours: number;
      description: string | null;
    }> = [];

    for (const person of selectedPersonnelList) {
      // Get existing hours for this personnel this week
      const { data: weeklyEntries } = await supabase
        .from("time_entries")
        .select("hours")
        .eq("personnel_id", person.id)
        .gte("entry_date", weekStartStr)
        .lte("entry_date", weekEndStr);

      const existingHours = weeklyEntries?.reduce((sum, e) => sum + Number(e.hours), 0) || 0;
      const newHours = person.hours;
      const totalWeeklyHours = existingHours + newHours;

      let regularHours = newHours;
      let overtimeHours = 0;

      if (totalWeeklyHours > 40) {
        if (existingHours >= 40) {
          regularHours = 0;
          overtimeHours = newHours;
        } else {
          regularHours = Math.max(0, 40 - existingHours);
          overtimeHours = newHours - regularHours;
        }
      }

      entries.push({
        personnel_id: person.id,
        project_id: selectedProject,
        entry_date: selectedDate,
        hours: newHours,
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        description: person.notes || null,
      });
    }

    bulkAddMutation.mutate(entries, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Team Time</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
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

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

          {/* Personnel Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Select Personnel *
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
            
            {loadingPersonnel ? (
              <div className="py-4 text-center text-muted-foreground">Loading personnel...</div>
            ) : !selectedProject ? (
              <div className="py-4 text-center text-muted-foreground">
                Select a project first
              </div>
            ) : assignedPersonnel.length === 0 ? (
              <div className="py-6 text-center border rounded-lg bg-secondary/30">
                <p className="text-muted-foreground mb-3">No personnel assigned to this project</p>
                <div className="flex justify-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setQuickAddOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Add New Personnel
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setAssignExistingOpen(true)}
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Assign Existing
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg">
                  {assignedPersonnel.map((assignment) => {
                    const person = assignment.personnel;
                    if (!person) return null;
                    const selected = personnelHours.get(person.id)?.selected || false;
                    return (
                      <div
                        key={person.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          selected ? "bg-primary/20" : "hover:bg-secondary"
                        }`}
                        onClick={() => togglePersonnel(person.id)}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className="text-sm truncate">
                          {person.first_name} {person.last_name}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          ${person.hourly_rate || 0}/hr
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    className="text-xs"
                    onClick={() => setQuickAddOpen(true)}
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Add New
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    className="text-xs"
                    onClick={() => setAssignExistingOpen(true)}
                  >
                    <UserCheck className="h-3 w-3 mr-1" />
                    Assign Existing
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Personnel Hours - Expandable rows */}
          {selectedPersonnelList.length > 0 && (
            <div className="space-y-2">
              <Label>Enter Hours (click to expand)</Label>
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  {Array.from(personnelHours.entries())
                    .filter(([_, data]) => data.selected)
                    .map(([personnelId, data]) => {
                      const assignment = assignedPersonnel.find((a) => a.personnel?.id === personnelId);
                      const person = assignment?.personnel;
                      if (!person) return null;
                      
                      const hours = parseFloat(data.hours || "0");
                      const cost = hours * (person.hourly_rate || 0);
                      const isExpanded = expandedPersonnel.has(personnelId);
                      
                      return (
                        <div key={personnelId} className="border-b last:border-b-0">
                          <div 
                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/50 transition-colors"
                            onClick={() => toggleExpanded(personnelId)}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-medium">
                                {person.first_name} {person.last_name}
                              </span>
                              {hours > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {hours}h
                                </span>
                              )}
                            </div>
                            {hours > 0 && (
                              <span className="text-sm text-primary font-medium">
                                ${cost.toFixed(2)}
                              </span>
                            )}
                          </div>
                          
                          {isExpanded && (
                            <div className="p-3 pt-0 space-y-2 bg-secondary/20">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label htmlFor={`hours-${personnelId}`} className="text-xs">Hours *</Label>
                                  <Input
                                    id={`hours-${personnelId}`}
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    max="24"
                                    value={data.hours}
                                    onChange={(e) => updateHours(personnelId, e.target.value)}
                                    placeholder="8"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`notes-${personnelId}`} className="text-xs">Notes</Label>
                                  <Input
                                    id={`notes-${personnelId}`}
                                    value={data.notes}
                                    onChange={(e) => updateNotes(personnelId, e.target.value)}
                                    placeholder="Optional notes"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          {selectedPersonnelList.length > 0 && totalHours > 0 && (
            <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Personnel Selected</span>
                <span className="font-medium">{selectedPersonnelList.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Hours</span>
                <span className="font-medium">{totalHours.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Cost</span>
                <span className="font-medium text-primary">${totalCost.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={bulkAddMutation.isPending || selectedPersonnelList.length === 0}
            >
              {bulkAddMutation.isPending ? "Saving..." : "Log Time"}
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
