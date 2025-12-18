import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { usePersonnel } from "@/integrations/supabase/hooks/usePersonnel";
import { 
  usePersonnelByProject, 
  useBulkAssignPersonnelToProject,
  useRemovePersonnelFromProject
} from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { Users, UserPlus, X, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

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
  const [billRates, setBillRates] = useState<Record<string, number | null>>({});

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

  const togglePersonnel = (personnelId: string, defaultBillRate: number | null) => {
    const newSelected = new Set(selectedPersonnel);
    if (newSelected.has(personnelId)) {
      newSelected.delete(personnelId);
      // Remove bill rate
      const newRates = { ...billRates };
      delete newRates[personnelId];
      setBillRates(newRates);
    } else {
      newSelected.add(personnelId);
      // Initialize with default bill rate
      setBillRates(prev => ({ ...prev, [personnelId]: defaultBillRate }));
    }
    setSelectedPersonnel(newSelected);
  };

  const updateBillRate = (personnelId: string, rate: string) => {
    const numRate = rate ? parseFloat(rate) : null;
    setBillRates(prev => ({ ...prev, [personnelId]: numRate }));
  };

  const handleAssign = () => {
    if (!selectedProject || selectedPersonnel.size === 0) return;
    
    assignMutation.mutate({
      personnelIds: Array.from(selectedPersonnel),
      projectId: selectedProject,
      billRates,
    }, {
      onSuccess: () => {
        setSelectedPersonnel(new Set());
        setBillRates({});
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
              setBillRates({});
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
                  <div className="space-y-2">
                    {assignedPersonnel.map((assignment) => {
                      const person = assignment.personnel;
                      if (!person) return null;
                      return (
                        <div 
                          key={assignment.id} 
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {person.first_name} {person.last_name}
                            </span>
                            {assignment.bill_rate && (
                              <Badge variant="outline" className="text-xs">
                                {formatCurrency(assignment.bill_rate)}/hr
                              </Badge>
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
                {unassignedPersonnel.length === 0 ? (
                  <div className="py-2 text-sm text-muted-foreground">
                    All active personnel are already assigned
                  </div>
                ) : (
                  <>
                    <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                      {unassignedPersonnel.map((person) => {
                        const isSelected = selectedPersonnel.has(person.id);
                        const defaultRate = (person as any).bill_rate || null;
                        return (
                          <div
                            key={person.id}
                            className={`p-3 transition-colors ${
                              isSelected ? "bg-primary/10" : "hover:bg-secondary/50"
                            }`}
                          >
                            <div 
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={() => togglePersonnel(person.id, defaultRate)}
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
                              {defaultRate && (
                                <span className="text-xs text-muted-foreground">
                                  Default: {formatCurrency(defaultRate)}/hr
                                </span>
                              )}
                            </div>
                            
                            {/* Bill Rate Input - only shown when selected */}
                            {isSelected && (
                              <div className="mt-2 ml-6 flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Bill rate for this project"
                                  value={billRates[person.id] ?? ""}
                                  onChange={(e) => updateBillRate(person.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-8 w-32"
                                />
                                <span className="text-xs text-muted-foreground">/hr</span>
                              </div>
                            )}
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
