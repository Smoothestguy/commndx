import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, Calendar, Building2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useProjectsForPersonnel } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";

interface PersonnelProjectsListProps {
  personnelId: string;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {assignments.length} project{assignments.length !== 1 ? "s" : ""} assigned
        </p>
      </div>

      {assignments.map((assignment) => (
        <Card key={assignment.id}>
          <CardContent className="pt-6">
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

              <Button variant="outline" size="sm" asChild>
                <Link to={`/projects/${assignment.project_id}`}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Project
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
