import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, DollarSign, AlertCircle, Briefcase, Building2, Save, Loader2 } from "lucide-react";
import { useProjectsForPersonnel, useUpdateAssignmentRateBracket } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useActiveProjectRateBrackets } from "@/integrations/supabase/hooks/useProjectRateBrackets";

interface PersonnelRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnelId: string;
  personnelName: string;
}

interface ProjectRoleRowProps {
  assignment: {
    id: string;
    project_id: string;
    rate_bracket_id: string | null;
    project_rate_brackets: {
      id: string;
      name: string;
      bill_rate: number;
      overtime_multiplier: number;
    } | null;
    projects: {
      id: string;
      name: string;
      status: string;
      customers: { name: string; company: string | null } | null;
    } | null;
  };
}

function ProjectRoleRow({ assignment }: ProjectRoleRowProps) {
  const [selectedRateBracketId, setSelectedRateBracketId] = useState<string | null>(
    assignment.rate_bracket_id
  );
  const [hasChanges, setHasChanges] = useState(false);
  
  const { data: rateBrackets, isLoading: bracketsLoading } = useActiveProjectRateBrackets(
    assignment.project_id
  );
  const updateRateBracket = useUpdateAssignmentRateBracket();

  const handleRateBracketChange = (value: string) => {
    const newValue = value === "none" ? null : value;
    setSelectedRateBracketId(newValue);
    setHasChanges(newValue !== assignment.rate_bracket_id);
  };

  const handleSave = async () => {
    await updateRateBracket.mutateAsync({
      assignmentId: assignment.id,
      rateBracketId: selectedRateBracketId,
    });
    setHasChanges(false);
  };

  const selectedBracket = rateBrackets?.find(b => b.id === selectedRateBracketId);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-lg bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
          <Link 
            to={`/projects/${assignment.project_id}`}
            className="font-medium truncate hover:underline hover:text-primary transition-colors"
          >
            {assignment.projects?.name || "Unknown Project"}
          </Link>
          <Badge variant={assignment.projects?.status === "active" ? "default" : "secondary"} className="shrink-0">
            {assignment.projects?.status || "Unknown"}
          </Badge>
        </div>
        {assignment.projects?.customers && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1 ml-6">
            <Building2 className="h-3 w-3" />
            <span className="truncate">
              {assignment.projects.customers.company || assignment.projects.customers.name}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {bracketsLoading ? (
          <Skeleton className="h-9 w-40" />
        ) : rateBrackets && rateBrackets.length > 0 ? (
          <>
            <Select
              value={selectedRateBracketId || "none"}
              onValueChange={handleRateBracketChange}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select role">
                  {selectedBracket ? (
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-3 w-3" />
                      {selectedBracket.name} (${selectedBracket.bill_rate}/hr)
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No role assigned</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No role</span>
                </SelectItem>
                {rateBrackets.map((bracket) => (
                  <SelectItem key={bracket.id} value={bracket.id}>
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-3 w-3" />
                      {bracket.name}
                      <span className="text-muted-foreground">(${bracket.bill_rate}/hr)</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasChanges && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateRateBracket.isPending}
              >
                {updateRateBracket.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span>No rate brackets defined</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function PersonnelRolesDialog({
  open,
  onOpenChange,
  personnelId,
  personnelName,
}: PersonnelRolesDialogProps) {
  const { data: assignments, isLoading } = useProjectsForPersonnel(personnelId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Manage Project Roles - {personnelName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !assignments || assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No project assignments</p>
              <p className="text-sm">Assign this person to projects first to set their roles.</p>
            </div>
          ) : (
            assignments.map((assignment) => (
              <ProjectRoleRow key={assignment.id} assignment={assignment} />
            ))
          )}
        </div>

        <div className="text-xs text-muted-foreground pt-4 border-t">
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            <span>Rate changes will apply to future time entries and invoices.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
