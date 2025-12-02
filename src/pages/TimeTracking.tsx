import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Plus, Table, Calendar as CalendarIcon } from "lucide-react";
import { TimeTrackingStats } from "@/components/time-tracking/TimeTrackingStats";
import { TimeTrackingFilters } from "@/components/time-tracking/TimeTrackingFilters";
import { TimeTrackingTable } from "@/components/time-tracking/TimeTrackingTable";
import { TimeEntryForm } from "@/components/time-tracking/TimeEntryForm";
import { WeeklyTimesheet } from "@/components/time-tracking/WeeklyTimesheet";
import { useAllTimeEntries, useTimeEntries, TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { useUserRole } from "@/hooks/useUserRole";
import { SEO } from "@/components/SEO";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function TimeTracking() {
  const [projectFilter, setProjectFilter] = useState<string>();
  const [personnelFilter, setPersonnelFilter] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [weeklySheetOpen, setWeeklySheetOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntryWithDetails | undefined>();
  
  const { isAdmin, isManager } = useUserRole();
  const showAllEntries = isAdmin || isManager;

  // Fetch data based on role
  const { data: allEntries = [] } = useAllTimeEntries(
    projectFilter === "all" ? undefined : projectFilter,
    personnelFilter === "all" ? undefined : personnelFilter
  );
  
  const { data: userEntries = [] } = useTimeEntries();

  // Convert userEntries to match TimeEntryWithDetails structure for consistent rendering
  const userEntriesWithDetails: TimeEntryWithDetails[] = userEntries.map(entry => ({
    ...entry,
    profiles: null,
    projects: null,
  }));

  const entries = showAllEntries ? allEntries : userEntriesWithDetails;

  const handleProjectChange = (value: string) => {
    setProjectFilter(value === "all" ? undefined : value);
  };

  const handlePersonnelChange = (value: string) => {
    setPersonnelFilter(value === "all" ? undefined : value);
  };

  const handleEdit = (entry: TimeEntryWithDetails) => {
    setSelectedEntry(entry);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setSelectedEntry(undefined);
  };

  return (
    <PageLayout title="Time Tracking">
      <SEO 
        title="Time Tracking - Command X"
        description="Track your time with daily and weekly timesheet views. Log hours against projects and job orders with automatic synchronization."
      />
      
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-wrap gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => setWeeklySheetOpen(true)}
          >
            <Table className="h-4 w-4 mr-2" />
            Weekly Timesheet
          </Button>
          <Button
            variant="outline"
            onClick={() => setWeeklySheetOpen(true)}
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Weekly Entry
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Time
          </Button>
        </div>

        {/* Stats */}
        <TimeTrackingStats entries={entries} />

        {/* Filters */}
        <TimeTrackingFilters
          projectFilter={projectFilter}
          personnelFilter={personnelFilter}
          onProjectChange={handleProjectChange}
          onPersonnelChange={handlePersonnelChange}
        />

        {/* Table */}
        <TimeTrackingTable entries={entries} onEdit={handleEdit} />

        {/* Time Entry Form Dialog */}
        <TimeEntryForm
          open={formOpen}
          onOpenChange={handleCloseForm}
          entry={selectedEntry}
        />

        {/* Weekly Timesheet Sheet */}
        <Sheet open={weeklySheetOpen} onOpenChange={setWeeklySheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Weekly Timesheet</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <WeeklyTimesheet currentWeek={new Date()} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </PageLayout>
  );
}
