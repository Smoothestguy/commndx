import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimeTrackingStats } from "@/components/time-tracking/TimeTrackingStats";
import { TimeTrackingFilters } from "@/components/time-tracking/TimeTrackingFilters";
import { GroupedTimeTrackingTable } from "@/components/time-tracking/GroupedTimeTrackingTable";
import { EnhancedTimeEntryForm } from "@/components/time-tracking/EnhancedTimeEntryForm";
import { WeeklyTimesheet } from "@/components/time-tracking/WeeklyTimesheet";
import { WeekNavigator } from "@/components/time-tracking/WeekNavigator";
import { ProjectAssignmentsSection } from "@/components/time-tracking/ProjectAssignmentsSection";
import { BulkTimeEntryForm } from "@/components/time-tracking/BulkTimeEntryForm";
import { PersonnelAssignmentDialog } from "@/components/time-tracking/PersonnelAssignmentDialog";
import { useAllTimeEntries, useTimeEntries, useBulkDeleteTimeEntries, TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { useUserRole } from "@/hooks/useUserRole";
import { SEO } from "@/components/SEO";

export default function TimeTracking() {
  const [projectFilter, setProjectFilter] = useState<string>();
  const [personnelFilter, setPersonnelFilter] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [bulkFormOpen, setBulkFormOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntryWithDetails | undefined>();
  const [weeklyViewWeek, setWeeklyViewWeek] = useState(() => new Date());
  
  const { isAdmin, isManager } = useUserRole();
  const canManageTeam = isAdmin || isManager;
  const showAllEntries = isAdmin || isManager;

  // Fetch data based on role
  const { data: allEntries = [] } = useAllTimeEntries(
    projectFilter === "all" ? undefined : projectFilter,
    personnelFilter === "all" ? undefined : personnelFilter
  );
  
  const { data: userEntries = [] } = useTimeEntries();
  const bulkDelete = useBulkDeleteTimeEntries();

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
        <div className="flex justify-end gap-2">
          {canManageTeam && (
            <>
              <Button variant="outline" onClick={() => setAssignmentDialogOpen(true)}>
                <Users className="h-4 w-4 mr-2" />
                Manage Personnel
              </Button>
              <Button variant="secondary" onClick={() => setBulkFormOpen(true)}>
                <Users className="h-4 w-4 mr-2" />
                Log Team Time
              </Button>
            </>
          )}
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Time
          </Button>
        </div>

        {/* Stats */}
        <TimeTrackingStats entries={entries} />

        {/* Tabs */}
        <Tabs defaultValue="entries" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="entries">Time Entries</TabsTrigger>
            <TabsTrigger value="weekly">Weekly View</TabsTrigger>
            <TabsTrigger value="assignments">My Assignments</TabsTrigger>
          </TabsList>

          <TabsContent value="entries" className="space-y-4 mt-4">
            {/* Filters */}
            <TimeTrackingFilters
              projectFilter={projectFilter}
              personnelFilter={personnelFilter}
              onProjectChange={handleProjectChange}
              onPersonnelChange={handlePersonnelChange}
            />

            {/* Grouped Table */}
            <GroupedTimeTrackingTable 
              entries={entries} 
              onEdit={handleEdit} 
              onBulkDelete={canManageTeam ? (ids) => bulkDelete.mutate(ids) : undefined}
              isDeleting={bulkDelete.isPending}
            />
          </TabsContent>

          <TabsContent value="weekly" className="space-y-4 mt-4">
            {/* Week Navigator */}
            <div className="flex justify-center">
              <WeekNavigator currentWeek={weeklyViewWeek} onWeekChange={setWeeklyViewWeek} />
            </div>
            
            {/* Weekly Timesheet */}
            <WeeklyTimesheet currentWeek={weeklyViewWeek} />
          </TabsContent>

          <TabsContent value="assignments" className="mt-4">
            <ProjectAssignmentsSection />
          </TabsContent>
        </Tabs>

        {/* Enhanced Time Entry Form Dialog */}
        <EnhancedTimeEntryForm
          open={formOpen}
          onOpenChange={handleCloseForm}
          entry={selectedEntry}
        />

        {/* Bulk Time Entry Form for Admins/Managers */}
        {canManageTeam && (
          <>
            <BulkTimeEntryForm
              open={bulkFormOpen}
              onOpenChange={setBulkFormOpen}
            />
            <PersonnelAssignmentDialog
              open={assignmentDialogOpen}
              onOpenChange={setAssignmentDialogOpen}
            />
          </>
        )}
      </div>
    </PageLayout>
  );
}
