import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Plus, Users, DollarSign, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimeTrackingStats } from "@/components/time-tracking/TimeTrackingStats";
import { TimeTrackingFilters } from "@/components/time-tracking/TimeTrackingFilters";
import { GroupedTimeTrackingTable } from "@/components/time-tracking/GroupedTimeTrackingTable";
import { EnhancedTimeEntryForm } from "@/components/time-tracking/EnhancedTimeEntryForm";
import { WeeklyTimesheetWithProject } from "@/components/time-tracking/WeeklyTimesheetWithProject";
import { WeekNavigator } from "@/components/time-tracking/WeekNavigator";
import { ProjectAssignmentsSection } from "@/components/time-tracking/ProjectAssignmentsSection";
import { PersonnelAssignmentDialog } from "@/components/time-tracking/PersonnelAssignmentDialog";
import { CreateVendorBillFromTimeDialog } from "@/components/time-tracking/CreateVendorBillFromTimeDialog";
import { CreateCustomerInvoiceFromTimeDialog } from "@/components/time-tracking/CreateCustomerInvoiceFromTimeDialog";
import {
  useAllTimeEntries,
  useTimeEntries,
  useBulkDeleteTimeEntries,
  useUpdateTimeEntryStatus,
  TimeEntryWithDetails,
} from "@/integrations/supabase/hooks/useTimeEntries";
import { useUserRole } from "@/hooks/useUserRole";
import { useGenerateWeeklyPayroll } from "@/hooks/useGenerateWeeklyPayroll";
import { SEO } from "@/components/SEO";

export default function TimeTracking() {
  const navigate = useNavigate();
  const [projectFilter, setProjectFilter] = useState<string>();
  const [personnelFilter, setPersonnelFilter] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [vendorBillDialogOpen, setVendorBillDialogOpen] = useState(false);
  const [customerInvoiceDialogOpen, setCustomerInvoiceDialogOpen] =
    useState(false);
  const [selectedEntry, setSelectedEntry] = useState<
    TimeEntryWithDetails | undefined
  >();
  const [selectedEntriesForBill, setSelectedEntriesForBill] = useState<
    TimeEntryWithDetails[]
  >([]);
  const [selectedEntriesForInvoice, setSelectedEntriesForInvoice] = useState<
    TimeEntryWithDetails[]
  >([]);
  const [weeklyViewWeek, setWeeklyViewWeek] = useState(() => new Date());

  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const canManageTeam = isAdmin || isManager;
  const showAllEntries = isAdmin || isManager;

  // Fetch data based on role - only enable admin query when role is confirmed
  const { data: allEntries = [], isLoading: allEntriesLoading } =
    useAllTimeEntries(
      projectFilter === "all" ? undefined : projectFilter,
      personnelFilter === "all" ? undefined : personnelFilter,
      { enabled: showAllEntries && !roleLoading }
    );

  const { data: userEntries = [], isLoading: userEntriesLoading } =
    useTimeEntries();
  const bulkDelete = useBulkDeleteTimeEntries();
  const updateStatus = useUpdateTimeEntryStatus();
  const generatePayroll = useGenerateWeeklyPayroll();

  // Convert userEntries to match TimeEntryWithDetails structure for consistent rendering
  const userEntriesWithDetails: TimeEntryWithDetails[] = userEntries.map(
    (entry) => ({
      ...entry,
      profiles: null,
      projects: null,
    })
  );

  const entries = showAllEntries ? allEntries : userEntriesWithDetails;
  const isLoading =
    roleLoading || (showAllEntries ? allEntriesLoading : userEntriesLoading);

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

  const handleCreateVendorBill = (selectedEntries: TimeEntryWithDetails[]) => {
    setSelectedEntriesForBill(selectedEntries);
    setVendorBillDialogOpen(true);
  };

  const handleCreateCustomerInvoice = (
    selectedEntries: TimeEntryWithDetails[]
  ) => {
    setSelectedEntriesForInvoice(selectedEntries);
    setCustomerInvoiceDialogOpen(true);
  };

  if (isLoading) {
    return (
      <PageLayout title="Time Tracking">
        <SEO
          title="Time Tracking - Command X"
          description="Track your time with daily and weekly timesheet views. Log hours against projects and job orders with automatic synchronization."
        />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">
            Loading time entries...
          </span>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Time Tracking">
      <SEO
        title="Time Tracking - Command X"
        description="Track your time with daily and weekly timesheet views. Log hours against projects and job orders with automatic synchronization."
      />

      <div className="w-full max-w-full overflow-hidden space-y-6">
        {/* Header Actions */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-2">
          {canManageTeam && (
            <>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => generatePayroll.mutate(undefined)}
                disabled={generatePayroll.isPending}
              >
                {generatePayroll.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                <span className="truncate">Generate Payroll</span>
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setAssignmentDialogOpen(true)}
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="truncate">Manage Personnel</span>
              </Button>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => navigate("/team-timesheet")}
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="truncate">Log Team Time</span>
              </Button>
            </>
          )}
          <Button
            className={
              canManageTeam
                ? "col-span-2 sm:col-span-1 w-full sm:w-auto"
                : "col-span-2 w-full sm:w-auto"
            }
            onClick={() => setFormOpen(true)}
          >
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
              onBulkDelete={
                canManageTeam ? (ids) => bulkDelete.mutate(ids) : undefined
              }
              onStatusChange={
                canManageTeam
                  ? (ids, status) => updateStatus.mutate({ ids, status })
                  : undefined
              }
              onCreateVendorBill={
                canManageTeam ? handleCreateVendorBill : undefined
              }
              onCreateCustomerInvoice={
                canManageTeam ? handleCreateCustomerInvoice : undefined
              }
              isDeleting={bulkDelete.isPending}
              isUpdatingStatus={updateStatus.isPending}
            />
          </TabsContent>

          <TabsContent value="weekly" className="space-y-4 mt-4">
            {/* Week Navigator */}
            <div className="flex justify-center">
              <WeekNavigator
                currentWeek={weeklyViewWeek}
                onWeekChange={setWeeklyViewWeek}
              />
            </div>

            {/* Weekly Timesheet with Project Selector */}
            <WeeklyTimesheetWithProject
              currentWeek={weeklyViewWeek}
              onWeekChange={setWeeklyViewWeek}
            />
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

        {/* Personnel Assignment Dialog for Admins/Managers */}
        {canManageTeam && (
          <PersonnelAssignmentDialog
            open={assignmentDialogOpen}
            onOpenChange={setAssignmentDialogOpen}
          />
        )}

        {/* Create Vendor Bill from Time Entries Dialog */}
        {canManageTeam && (
          <CreateVendorBillFromTimeDialog
            open={vendorBillDialogOpen}
            onOpenChange={setVendorBillDialogOpen}
            selectedEntries={selectedEntriesForBill}
            onSuccess={() => setSelectedEntriesForBill([])}
          />
        )}

        {/* Create Customer Invoice from Time Entries Dialog */}
        {canManageTeam && (
          <CreateCustomerInvoiceFromTimeDialog
            open={customerInvoiceDialogOpen}
            onOpenChange={setCustomerInvoiceDialogOpen}
            selectedEntries={selectedEntriesForInvoice}
            onSuccess={() => setSelectedEntriesForInvoice([])}
          />
        )}
      </div>
    </PageLayout>
  );
}
