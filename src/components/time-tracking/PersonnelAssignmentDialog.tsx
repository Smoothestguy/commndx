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
  useRemovePersonnelFromProject,
  useUpdateAssignmentRateBracket
} from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useActiveProjectRateBrackets } from "@/integrations/supabase/hooks/useProjectRateBrackets";
import { Users, UserPlus, X, Briefcase, Pencil, Check, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [rateBracketSelections, setRateBracketSelections] = useState<Record<string, string>>({});
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editingRateBracketId, setEditingRateBracketId] = useState<string>("");

  const { data: projects = [] } = useProjects();
  const { data: allPersonnel = [] } = usePersonnel();
  const { data: assignedPersonnel = [], isLoading } = usePersonnelByProject(selectedProject);
  const { data: rateBrackets = [] } = useActiveProjectRateBrackets(selectedProject);
  const assignMutation = useBulkAssignPersonnelToProject();
  const removeMutation = useRemovePersonnelFromProject();
  const updateRateBracketMutation = useUpdateAssignmentRateBracket();

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
      // Remove rate bracket selection
      const newSelections = { ...rateBracketSelections };
      delete newSelections[personnelId];
      setRateBracketSelections(newSelections);
    } else {
      newSelected.add(personnelId);
    }
    setSelectedPersonnel(newSelected);
  };

  const updateRateBracketSelection = (personnelId: string, bracketId: string) => {
    setRateBracketSelections(prev => ({ ...prev, [personnelId]: bracketId }));
  };

  // Check if all selected personnel have rate brackets assigned
  const allHaveRateBrackets = useMemo(() => {
    if (selectedPersonnel.size === 0) return true;
    return Array.from(selectedPersonnel).every(id => rateBracketSelections[id]);
  }, [selectedPersonnel, rateBracketSelections]);

  const handleAssign = () => {
    if (!selectedProject || selectedPersonnel.size === 0 || !allHaveRateBrackets) return;
    
    assignMutation.mutate({
      personnelIds: Array.from(selectedPersonnel),
      projectId: selectedProject,
      rateBracketIds: rateBracketSelections,
    }, {
      onSuccess: () => {
        setSelectedPersonnel(new Set());
        setRateBracketSelections({});
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

  const startEditingRateBracket = (assignmentId: string, currentBracketId: string | null) => {
    setEditingAssignmentId(assignmentId);
    setEditingRateBracketId(currentBracketId || "");
  };

  const saveEditingRateBracket = () => {
    if (!editingAssignmentId || !editingRateBracketId) return;
    
    updateRateBracketMutation.mutate({
      assignmentId: editingAssignmentId,
      rateBracketId: editingRateBracketId,
    }, {
      onSuccess: () => {
        setEditingAssignmentId(null);
        setEditingRateBracketId("");
        onAssignmentChange?.();
      },
    });
  };

  const cancelEditingRateBracket = () => {
    setEditingAssignmentId(null);
    setEditingRateBracketId("");
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
              setRateBracketSelections({});
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
              {/* Rate Brackets Warning */}
              {rateBrackets.length === 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No rate brackets defined for this project. 
                    Please add rate brackets in Project Settings before assigning personnel.
                  </AlertDescription>
                </Alert>
              )}

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
                  <div className="space-y-2">
                    {assignedPersonnel.map((assignment) => {
                      const person = assignment.personnel;
                      if (!person) return null;
                      const isEditing = editingAssignmentId === assignment.id;
                      const bracket = assignment.project_rate_brackets;
                      
                      return (
                        <div 
                          key={assignment.id} 
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-2 flex-1 flex-wrap">
                            <span className="font-medium text-sm">
                              {person.first_name} {person.last_name}
                            </span>
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <Select 
                                  value={editingRateBracketId} 
                                  onValueChange={setEditingRateBracketId}
                                >
                                  <SelectTrigger className="h-7 w-40 text-xs">
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {rateBrackets.map((rb) => (
                                      <SelectItem key={rb.id} value={rb.id}>
                                        {rb.name} ({formatCurrency(rb.bill_rate)}/hr)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <button
                                  type="button"
                                  onClick={saveEditingRateBracket}
                                  disabled={!editingRateBracketId || updateRateBracketMutation.isPending}
                                  className="hover:bg-primary/20 rounded p-1 text-primary disabled:opacity-50"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditingRateBracket}
                                  className="hover:bg-muted rounded p-1"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditingRateBracket(assignment.id, assignment.rate_bracket_id)}
                                className="flex items-center gap-1 hover:bg-muted rounded px-1"
                              >
                                {bracket ? (
                                  <Badge variant="outline" className="text-xs cursor-pointer">
                                    <Briefcase className="h-3 w-3 mr-1" />
                                    {bracket.name} ({formatCurrency(bracket.bill_rate)}/hr)
                                    <Pencil className="h-3 w-3 ml-1" />
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-xs cursor-pointer">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    No role assigned
                                    <Pencil className="h-3 w-3 ml-1" />
                                  </Badge>
                                )}
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemove(assignment.id)}
                            disabled={removeMutation.isPending}
                            className="hover:bg-destructive/20 rounded p-1"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
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
                {rateBrackets.length === 0 ? (
                  <div className="py-2 text-sm text-muted-foreground">
                    Define rate brackets before assigning personnel
                  </div>
                ) : unassignedPersonnel.length === 0 ? (
                  <div className="py-2 text-sm text-muted-foreground">
                    All active personnel are already assigned
                  </div>
                ) : (
                  <>
                    <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                      {unassignedPersonnel.map((person) => {
                        const isSelected = selectedPersonnel.has(person.id);
                        const payRate = (person as any).pay_rate;
                        return (
                          <div
                            key={person.id}
                            className={`p-3 transition-colors ${
                              isSelected ? "bg-primary/10" : "hover:bg-secondary/50"
                            }`}
                          >
                            <div 
                              className="flex items-center gap-2 cursor-pointer"
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
                              <span className="text-sm font-medium flex-1">
                                {person.first_name} {person.last_name}
                              </span>
                              {payRate && (
                                <span className="text-xs text-muted-foreground">
                                  Pay: {formatCurrency(payRate)}/hr
                                </span>
                              )}
                            </div>
                            
                            {/* Rate Bracket Selection - only shown when selected */}
                            {isSelected && (
                              <div className="mt-2 ml-6 flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-muted-foreground" />
                                <Select
                                  value={rateBracketSelections[person.id] || ""}
                                  onValueChange={(value) => updateRateBracketSelection(person.id, value)}
                                >
                                  <SelectTrigger 
                                    className="h-8 w-48"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <SelectValue placeholder="Select role *" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {rateBrackets.map((rb) => (
                                      <SelectItem key={rb.id} value={rb.id}>
                                        {rb.name} ({formatCurrency(rb.bill_rate)}/hr)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {!rateBracketSelections[person.id] && (
                                  <span className="text-xs text-destructive">Required</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      onClick={handleAssign}
                      disabled={selectedPersonnel.size === 0 || !allHaveRateBrackets || assignMutation.isPending}
                      className="w-full"
                    >
                      {assignMutation.isPending 
                        ? "Assigning..." 
                        : `Assign ${selectedPersonnel.size} Personnel`}
                    </Button>
                    {selectedPersonnel.size > 0 && !allHaveRateBrackets && (
                      <p className="text-xs text-destructive text-center">
                        All selected personnel must have a role assigned
                      </p>
                    )}
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
