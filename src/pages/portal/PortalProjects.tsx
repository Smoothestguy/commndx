import { useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelAssignments, usePersonnelTimeEntries } from "@/integrations/supabase/hooks/usePortal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Calendar, Clock, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PortalProjects() {
  const navigate = useNavigate();
  const { data: personnel } = useCurrentPersonnel();
  const { data: assignments, isLoading } = usePersonnelAssignments(personnel?.id);
  const { data: timeEntries } = usePersonnelTimeEntries(personnel?.id);

  // Calculate hours per project
  const hoursByProject = timeEntries?.reduce((acc, entry) => {
    const projectId = entry.project_id;
    if (!acc[projectId]) {
      acc[projectId] = { regular: 0, overtime: 0 };
    }
    acc[projectId].regular += entry.regular_hours || 0;
    acc[projectId].overtime += entry.overtime_hours || 0;
    return acc;
  }, {} as Record<string, { regular: number; overtime: number }>) || {};

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Projects</h1>
          <p className="text-muted-foreground">Projects you're currently assigned to</p>
        </div>

        {assignments && assignments.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {assignments.map((assignment) => {
              const project = assignment.project;
              const projectHours = hoursByProject[project?.id || ""] || { regular: 0, overtime: 0 };
              const totalHours = projectHours.regular + projectHours.overtime;
              
              return (
                <Card 
                  key={assignment.id}
                  className="cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() => navigate(`/portal/projects/${project?.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Briefcase className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg group-hover:text-primary transition-colors">
                            {project?.name}
                          </CardTitle>
                          <CardDescription>
                            Assigned {format(parseISO(assignment.assigned_at), "MMM d, yyyy")}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={project?.status === "active" ? "default" : "secondary"}>
                          {project?.status}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {project?.start_date 
                            ? format(parseISO(project.start_date), "MMM d, yyyy")
                            : "No start date"
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{totalHours.toFixed(1)} hrs logged</span>
                      </div>
                    </div>
                    
                    {totalHours > 0 && (
                      <div className="pt-4 border-t">
                        <div className="text-sm text-muted-foreground mb-2">Hours Breakdown</div>
                        <div className="flex gap-4">
                          <div>
                            <span className="text-lg font-semibold">{projectHours.regular.toFixed(1)}</span>
                            <span className="text-sm text-muted-foreground ml-1">regular</span>
                          </div>
                          {projectHours.overtime > 0 && (
                            <div>
                              <span className="text-lg font-semibold text-orange-500">{projectHours.overtime.toFixed(1)}</span>
                              <span className="text-sm text-muted-foreground ml-1">overtime</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No active projects</h3>
              <p className="text-muted-foreground text-center">
                You are not currently assigned to any projects.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
