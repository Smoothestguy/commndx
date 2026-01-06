import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FolderKanban, Calendar, Building2, ExternalLink, Briefcase, AlertCircle, Save, Loader2, UserMinus } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useProjectsForPersonnel, useUpdateAssignmentRateBracket, useRemovePersonnelFromProject } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";
import { useActiveProjectRateBrackets } from "@/integrations/supabase/hooks/useProjectRateBrackets";

interface PersonnelProjectsListProps {
  personnelId: string;
}

interface ProjectCardProps {
  assignment: {
    id: string;
    project_id: string;
    assigned_at: string;
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
      start_date: string | null;
      end_date: string | null;
      customers: { name: string; company: string | null } | null;
    } | null;
  };
}

function ProjectCard({ assignment }: ProjectCardProps) {
  const [selectedRateBracketId, setSelectedRateBracketId] = useState<string | null>(
    assignment.rate_bracket_id
  );
  const [hasChanges, setHasChanges] = useState(false);
  
  const { data: rateBrackets, isLoading: bracketsLoading } = useActiveProjectRateBrackets(
    assignment.project_id
  );
  const updateRateBracket = useUpdateAssignmentRateBracket();
  const removeFromProject = useRemovePersonnelFromProject();

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "completed":
        return "secondary";
      case "on_hold":
        return "outline";
      default:
        return "secondary";
    }
  };

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
  const currentBracket = assignment.project_rate_brackets;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold">{assignment.projects?.name || "Unknown Project"}</h4>
                <Badge variant={getStatusVariant(assignment.projects?.status || "")}>
                  {assignment.projects?.status || "Unknown"}
                </Badge>
              </div>

              {assignment.projects?.customers && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>
                    {assignment.projects.customers.company || assignment.projects.customers.name}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Assigned: {format(new Date(assignment.assigned_at), "MMM d, yyyy")}</span>
                </div>
                {assignment.projects?.start_date && (
                  <div className="flex items-center gap-1">
                    <span>Started: {format(new Date(assignment.projects.start_date), "MMM d, yyyy")}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={removeFromProject.isPending}
                  >
                    {removeFromProject.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <UserMinus className="h-4 w-4 mr-2" />
                    )}
                    Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove from Project</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove this personnel from "{assignment.projects?.name}"? 
                      They will no longer have access to this project. Any existing time entries will be preserved.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => removeFromProject.mutate(assignment.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <Button variant="outline" size="sm" asChild>
                <Link to={`/projects/${assignment.project_id}`}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Project
                </Link>
              </Button>
            </div>
          </div>

          {/* Role/Rate Bracket Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span>Role:</span>
            </div>
            
            {bracketsLoading ? (
              <Skeleton className="h-9 w-48" />
            ) : rateBrackets && rateBrackets.length > 0 ? (
              <div className="flex items-center gap-2 flex-1">
                <Select
                  value={selectedRateBracketId || "none"}
                  onValueChange={handleRateBracketChange}
                >
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue placeholder="Select role">
                      {selectedBracket ? (
                        <span className="flex items-center gap-2">
                          {selectedBracket.name}
                          <span className="text-muted-foreground">(${selectedBracket.bill_rate}/hr)</span>
                        </span>
                      ) : currentBracket ? (
                        <span className="flex items-center gap-2">
                          {currentBracket.name}
                          <span className="text-muted-foreground">(${currentBracket.bill_rate}/hr)</span>
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
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span>No rate brackets configured for this project</span>
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link to={`/projects/${assignment.project_id}?tab=settings`}>
                    Configure
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PersonnelProjectsList({ personnelId }: PersonnelProjectsListProps) {
  const { data: assignments, isLoading } = useProjectsForPersonnel(personnelId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No project assignments</p>
            <p className="text-sm">This personnel member is not assigned to any projects.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {assignments.length} project{assignments.length !== 1 ? "s" : ""} assigned
        </p>
      </div>

      {assignments.map((assignment) => (
        <ProjectCard key={assignment.id} assignment={assignment} />
      ))}
    </div>
  );
}
