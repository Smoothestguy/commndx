import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { useClockEnabledProjects, useAllOpenClockEntries } from "@/integrations/supabase/hooks/useTimeClock";
import { ClockStatusCard } from "@/components/portal/ClockStatusCard";
import { ClockHistoryTable } from "@/components/portal/ClockHistoryTable";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalTimeClock() {
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();
  const { data: projects, isLoading: projectsLoading } = useClockEnabledProjects(personnel?.id);
  const { data: openEntries, isLoading: entriesLoading } = useAllOpenClockEntries(personnel?.id);

  const isLoading = personnelLoading || projectsLoading || entriesLoading;

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </PortalLayout>
    );
  }

  // Get the active entry (first open entry)
  const activeEntry = openEntries?.[0] || null;

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Time Clock</h1>
          <p className="text-muted-foreground">
            Clock in and out of your assigned projects
          </p>
        </div>

        {/* Main Clock Status Card */}
        <ClockStatusCard
          personnelId={personnel?.id || ""}
          projects={projects || []}
          activeEntry={activeEntry}
        />

        {/* Clock History */}
        <ClockHistoryTable personnelId={personnel?.id || ""} />
      </div>
    </PortalLayout>
  );
}
