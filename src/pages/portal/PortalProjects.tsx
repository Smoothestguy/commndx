import { useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelAssignments, usePersonnelAllAssignments, usePersonnelTimeEntries } from "@/integrations/supabase/hooks/usePortal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Calendar, Clock, ChevronRight, History } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PortalProjects() {
  const navigate = useNavigate();
  const { data: personnel } = useCurrentPersonnel();
  const { data: activeAssignments, isLoading: activeLoading } = usePersonnelAssignments(personnel?.id);
  const { data: allAssignments, isLoading: allLoading } = usePersonnelAllAssignments(personnel?.id);
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

  // Current projects = active assignments
  const currentProjects = activeAssignments || [];
  
  // Past projects = assignments that are not active, deduplicated by project ID
  // (show latest assignment for each project that's not currently active)
  const activeProjectIds = new Set(currentProjects.map(a => a.project?.id));
  const pastProjectsRaw = allAssignments?.filter(a => 
    a.status !== 'active' && 
    a.project?.id && 
    !activeProjectIds.has(a.project.id)
  ) || [];
  
  // Deduplicate past projects - show only the most recent assignment per project
  const pastProjectsMap = new Map<string, typeof pastProjectsRaw[0]>();
  pastProjectsRaw.forEach(assignment => {
    const projectId = assignment.project?.id;
    if (projectId && !pastProjectsMap.has(projectId)) {
      pastProjectsMap.set(projectId, assignment);
    }
  });
  const pastProjects = Array.from(pastProjectsMap.values());

  const isLoading = activeLoading || allLoading;

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

  const ProjectCard = ({ assignment, isPast = false }: { assignment: typeof currentProjects[0]; isPast?: boolean }) => {
    const project = assignment.project;
    const projectHours = hoursByProject[project?.id || ""] || { regular: 0, overtime: 0 };
    const totalHours = projectHours.regular + projectHours.overtime;
    
    return (
      <Card 
        key={assignment.id}
        className={`cursor-pointer hover:shadow-md transition-shadow group ${isPast ? 'opacity-80' : ''}`}
        onClick={() => navigate(`/portal/projects/${project?.id}`)}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isPast ? 'bg-muted' : 'bg-primary/10'}`}>
                {isPast ? (
                  <History className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Briefcase className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">
                  {project?.name}
                </CardTitle>
                <CardDescription>
                  {isPast && assignment.unassigned_at ? (
                    <>Ended {format(parseISO(assignment.unassigned_at), "MMM d, yyyy")}</>
                  ) : (
                    <>Assigned {format(parseISO(assignment.assigned_at), "MMM d, yyyy")}</>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={project?.status === "active" ? "default" : "secondary"}>
                {project?.status}
              </Badge>
              {isPast && (
                <Badge variant="outline" className="text-xs">
                  History
                </Badge>
              )}
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
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Projects</h1>
          <p className="text-muted-foreground">Projects you're currently assigned to and past project history</p>
        </div>

        {/* Current Projects */}
        {currentProjects.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Current Projects
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {currentProjects.map((assignment) => (
                <ProjectCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          </div>
        )}

        {/* Past Projects */}
        {pastProjects.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
              <History className="h-5 w-5" />
              Past Projects
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {pastProjects.map((assignment) => (
                <ProjectCard key={assignment.id} assignment={assignment} isPast />
              ))}
            </div>
          </div>
        )}

        {/* No Projects */}
        {currentProjects.length === 0 && pastProjects.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects</h3>
              <p className="text-muted-foreground text-center">
                You have not been assigned to any projects yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}