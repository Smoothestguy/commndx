import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { useClockEnabledProjects, useAllOpenClockEntries, formatDateTime24h } from "@/integrations/supabase/hooks/useTimeClock";
import { ProjectClockCard } from "@/components/portal/ProjectClockCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Timer, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";

export default function PortalTimeClock() {
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();
  const { data: projects, isLoading: projectsLoading } = useClockEnabledProjects(personnel?.id);
  const { data: openEntries, isLoading: entriesLoading } = useAllOpenClockEntries(personnel?.id);

  const isLoading = personnelLoading || projectsLoading || entriesLoading;

  // Calculate today's total clocked hours
  const todayStats = useMemo(() => {
    if (!openEntries) return { activeProject: null, totalHours: 0 };

    const now = new Date();
    let totalSeconds = 0;
    let activeProject: string | null = null;

    openEntries.forEach((entry) => {
      if (entry.clock_in_at) {
        const clockIn = new Date(entry.clock_in_at);
        totalSeconds += (now.getTime() - clockIn.getTime()) / 1000;
        activeProject = entry.project?.name || null;
      }
    });

    return {
      activeProject,
      totalHours: totalSeconds / 3600,
    };
  }, [openEntries]);

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </PortalLayout>
    );
  }

  const hasOpenEntry = (openEntries?.length || 0) > 0;

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Time Clock</h1>
          <p className="text-muted-foreground">
            Clock in and out of your assigned projects
          </p>
        </div>

        {/* Status Summary */}
        {hasOpenEntry && openEntries?.[0] && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                Currently Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-medium">{todayStats.activeProject}</p>
                  <p className="text-sm text-muted-foreground">
                    Since {formatDateTime24h(openEntries[0].clock_in_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-lg font-mono">
                  <Timer className="h-5 w-5 text-green-600" />
                  <span>{todayStats.totalHours.toFixed(2)} hrs</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projects Grid */}
        {projects && projects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectClockCard
                key={project.id}
                project={project}
                personnelId={personnel?.id || ""}
                hasOtherOpenEntry={
                  hasOpenEntry && 
                  openEntries?.some((e) => e.project_id !== project.id) || false
                }
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Clock-Enabled Projects</h3>
              <p className="text-muted-foreground max-w-md">
                You don't have any projects with time clock enabled. Contact your administrator
                if you believe you should have clock-in access.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
