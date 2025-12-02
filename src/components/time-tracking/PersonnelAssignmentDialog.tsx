import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { usePersonnel } from "@/integrations/supabase/hooks/usePersonnel";
import { 
  usePersonnelByProject, 
  useBulkAssignPersonnelToProject,
  useRemovePersonnelFromProject
} from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { Users, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PersonnelAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
  onAssignmentChange?: () => void;
}

export function PersonnelAssignmentDialog({ 
  open, 
  onOpenChange, 
  defaultProjectId,
  onAssignmentChange 
}: PersonnelAssignmentDialogProps) {
  const [selectedProject, setSelectedProject] = useState(defaultProjectId || "");
  const [selectedPersonnel, setSelectedPersonnel] = useState<Set<string>>(new Set());

  const { data: projects = [] } = useProjects();
  const { data: allPersonnel = [] } = usePersonnel();
  const { data: assignedPersonnel = [], isLoading } = usePersonnelByProject(selectedProject);
  const assignMutation = useBulkAssignPersonnelToProject();
  const removeMutation = useRemovePersonnelFromProject();

  // Set project from prop when dialog opens
  useEffect(() => {
    if (open && defaultProjectId) {
      setSelectedProject(defaultProjectId);
    }
  }, [open, defaultProjectId]);

  const activeProjects = useMemo(() => 
    projects.filter(p => p.status === "active"), 
    [projects]
  );

  const activePersonnel = useMemo(() => 
    allPersonnel.filter(p => p.status === "active"),
    [allPersonnel]
  );

  const assignedIds = useMemo(() => 
    new Set(assignedPersonnel.map(a => a.personnel?.id).filter(Boolean)),
    [assignedPersonnel]
  );

  const unassignedPersonnel = useMemo(() => 
    activePersonnel.filter(p => !assignedIds.has(p.id)),
    [activePersonnel, assignedIds]
  );

  const togglePersonnel = (personnelId: string) => {
    const newSelected = new Set(selectedPersonnel);
    if (newSelected.has(personnelId)) {
      newSelected.delete(personnelId);
    } else {
      newSelected.add(personnelId);
    }
    setSelectedPersonnel(newSelected);
  };

  const handleAssign = () => {
    if (!selectedProject || selectedPersonnel.size === 0) return;
    
    assignMutation.mutate({
      personnelIds: Array.from(selectedPersonnel),
      projectId: selectedProject,
    }, {
      onSuccess: () => {
        setSelectedPersonnel(new Set());
        onAssignmentChange?.();
      },
    });
  };

  const handleRemove = (assignmentId: string) => {
    removeMutation.mutate(assignmentId, {
      onSuccess: () => {
        onAssignmentChange?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Personnel Assignments</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label>Select Project</Label>
            <Select value={selectedProject} onValueChange={(v) => {
              setSelectedProject(v);
              setSelectedPersonnel(new Set());
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
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

          {selectedProject && (
            <>
              {/* Currently Assigned */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Currently Assigned ({assignedPersonnel.length})
                </Label>
                {isLoading ? (
                  <div className="py-2 text-sm text-muted-foreground">Loading...</div>
                ) : assignedPersonnel.length === 0 ? (
                  <div className="py-2 text-sm text-muted-foreground">No personnel assigned</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {assignedPersonnel.map((assignment) => {
                      const person = assignment.personnel;
                      if (!person) return null;
                      return (
                        <Badge 
                          key={assignment.id} 
                          variant="secondary"
                          className="flex items-center gap-1 pr-1"
                        >
                          {person.first_name} {person.last_name}
                          <button
                            type="button"
                            onClick={() => handleRemove(assignment.id)}
                            disabled={removeMutation.isPending}
                            className="ml-1 hover:bg-destructive/20 rounded p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Personnel */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add Personnel
                </Label>
                {unassignedPersonnel.length === 0 ? (
                  <div className="py-2 text-sm text-muted-foreground">
                    All active personnel are already assigned
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                      {unassignedPersonnel.map((person) => {
                        const isSelected = selectedPersonnel.has(person.id);
                        return (
                          <div
                            key={person.id}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                              isSelected ? "bg-primary/20" : "hover:bg-secondary"
                            }`}
                            onClick={() => togglePersonnel(person.id)}
                          >
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold ${
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground/40 text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                            <span className="text-sm truncate">
                              {person.first_name} {person.last_name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      onClick={handleAssign}
                      disabled={selectedPersonnel.size === 0 || assignMutation.isPending}
                      className="w-full"
                    >
                      {assignMutation.isPending 
                        ? "Assigning..." 
                        : `Assign ${selectedPersonnel.size} Personnel`}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
