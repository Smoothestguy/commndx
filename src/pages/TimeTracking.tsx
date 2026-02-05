import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { startOfWeek, endOfWeek, isWithinInterval, parseISO, addWeeks } from "date-fns";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Plus, Users, DollarSign, Loader2, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeTrackingStats } from "@/components/time-tracking/TimeTrackingStats";
import { ProjectTimeEntriesTable } from "@/components/time-tracking/ProjectTimeEntriesTable";
import { EnhancedTimeEntryForm } from "@/components/time-tracking/EnhancedTimeEntryForm";
import { WeeklyTimesheetWithProject } from "@/components/time-tracking/WeeklyTimesheetWithProject";
import { WeekNavigator } from "@/components/time-tracking/WeekNavigator";
import { ProjectAssignmentsSection } from "@/components/time-tracking/ProjectAssignmentsSection";
import { PersonnelAssignmentDialog } from "@/components/time-tracking/PersonnelAssignmentDialog";
import { CreateVendorBillFromTimeDialog } from "@/components/time-tracking/CreateVendorBillFromTimeDialog";
import { CreateCustomerInvoiceFromTimeDialog } from "@/components/time-tracking/CreateCustomerInvoiceFromTimeDialog";
import { BulkCustomerInvoiceDialog } from "@/components/time-tracking/BulkCustomerInvoiceDialog";
import { MobileActionBar } from "@/components/layout/MobileActionBar";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const [bulkInvoiceDialogOpen, setBulkInvoiceDialogOpen] = useState(false);
  const [selectedEntriesForBulkInvoice, setSelectedEntriesForBulkInvoice] = useState<
    TimeEntryWithDetails[]
  >([]);
  const [weeklyViewWeek, setWeeklyViewWeek] = useState(() => new Date());
  const [showMultipleWeeks, setShowMultipleWeeks] = useState(false);
  const [weeksToShow, setWeeksToShow] = useState(2);

  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const isMobile = useIsMobile();
  const canManageTeam = isAdmin || isManager;
  const showAllEntries = isAdmin || isManager;

  // Calculate week start for queries
  const weekStart = useMemo(() => 
    startOfWeek(weeklyViewWeek, { weekStartsOn: 1 }),
    [weeklyViewWeek]
  );

  // Fetch data based on role - only enable admin query when role is confirmed
  // No filters - we show all entries grouped by project
  const { data: allEntries = [], isLoading: allEntriesLoading } =
    useAllTimeEntries(
      undefined,
      undefined,
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

  // Filter entries by selected week (or multiple weeks)
  const filteredEntries = useMemo(() => {
    if (showMultipleWeeks) {
      // Multi-week mode: show entries from current week backwards
      const rangeEnd = endOfWeek(weeklyViewWeek, { weekStartsOn: 1 });
      const rangeStart = startOfWeek(addWeeks(weeklyViewWeek, -(weeksToShow - 1)), { weekStartsOn: 1 });
      return entries.filter(entry => {
        const entryDate = parseISO(entry.entry_date);
        return isWithinInterval(entryDate, { start: rangeStart, end: rangeEnd });
      });
    }
    // Single week mode
    const weekEnd = endOfWeek(weeklyViewWeek, { weekStartsOn: 1 });
    return entries.filter(entry => {
      const entryDate = parseISO(entry.entry_date);
      return isWithinInterval(entryDate, { start: weekStart, end: weekEnd });
    });
  }, [entries, weekStart, weeklyViewWeek, showMultipleWeeks, weeksToShow]);

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

  const handleBulkCreateInvoices = (
    selectedEntries: TimeEntryWithDetails[]
  ) => {
    setSelectedEntriesForBulkInvoice(selectedEntries);
    setBulkInvoiceDialogOpen(true);
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
        {/* Header Actions - Hidden on mobile, shown on tablet+ */}
        {!isMobile && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {canManageTeam && (
              <>
                <Button
                  variant="outline"
                  className="flex-1 min-w-[calc(50%-0.25rem)] sm:flex-none sm:min-w-0 h-11 sm:h-10"
                  onClick={() => generatePayroll.mutate(undefined)}
                  disabled={generatePayroll.isPending}
                >
                  {generatePayroll.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <DollarSign className="h-4 w-4 mr-2" />
                  )}
                  <span className="text-sm whitespace-nowrap">Generate Payroll</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 min-w-[calc(50%-0.25rem)] sm:flex-none sm:min-w-0 h-11 sm:h-10"
                  onClick={() => setAssignmentDialogOpen(true)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  <span className="text-sm whitespace-nowrap">Manage Personnel</span>
                </Button>
              </>
            )}
            <Button
              className="flex-1 min-w-[calc(50%-0.25rem)] sm:flex-none sm:min-w-0 h-11 sm:h-10"
              onClick={() => setFormOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="whitespace-nowrap">Log Time</span>
            </Button>
          </div>
        )}

        {/* Stats */}
        <TimeTrackingStats entries={entries} />

        {/* Tabs */}
        <Tabs defaultValue="entries" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px] h-auto overflow-x-auto">
            <TabsTrigger value="entries" className="text-xs sm:text-sm py-2.5 sm:py-1.5">Time Entries</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs sm:text-sm py-2.5 sm:py-1.5">Weekly View</TabsTrigger>
            <TabsTrigger value="assignments" className="text-xs sm:text-sm py-2.5 sm:py-1.5">My Assignments</TabsTrigger>
          </TabsList>

          <TabsContent value="entries" className="space-y-4 mt-4">
            {/* Week Navigator with Multi-Week Toggle */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <WeekNavigator
                currentWeek={weeklyViewWeek}
                onWeekChange={setWeeklyViewWeek}
              />
              
              {/* Multi-week toggle for bulk selection */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Switch
                  id="multi-week"
                  checked={showMultipleWeeks}
                  onCheckedChange={setShowMultipleWeeks}
                />
                <Label htmlFor="multi-week" className="text-sm cursor-pointer">
                  Multi-week
                </Label>
                {showMultipleWeeks && (
                  <Select value={String(weeksToShow)} onValueChange={v => setWeeksToShow(Number(v))}>
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 wks</SelectItem>
                      <SelectItem value="3">3 wks</SelectItem>
                      <SelectItem value="4">4 wks</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Project Time Entries Table - Hierarchical View */}
            <ProjectTimeEntriesTable
              entries={filteredEntries}
              weekStart={weekStart}
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
              onBulkCreateInvoices={
                canManageTeam ? handleBulkCreateInvoices : undefined
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

        {/* Bulk Create Customer Invoices Dialog */}
        {canManageTeam && (
          <BulkCustomerInvoiceDialog
            open={bulkInvoiceDialogOpen}
            onOpenChange={setBulkInvoiceDialogOpen}
            selectedEntries={selectedEntriesForBulkInvoice}
            onSuccess={() => setSelectedEntriesForBulkInvoice([])}
          />
        )}

        {/* Mobile Action Bar */}
        <MobileActionBar
          primaryActions={[
            {
              label: "Log Time",
              icon: <Plus className="h-4 w-4" />,
              onClick: () => setFormOpen(true),
              variant: "default",
            },
            ...(canManageTeam ? [{
              label: "Team Time",
              icon: <Users className="h-4 w-4" />,
              onClick: () => navigate("/team-timesheet"),
              variant: "outline" as const,
            }] : []),
          ]}
          secondaryActions={canManageTeam ? [
            {
              label: "Generate Payroll",
              icon: generatePayroll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />,
              onClick: () => generatePayroll.mutate(undefined),
              loading: generatePayroll.isPending,
            },
            {
              label: "Manage Personnel",
              icon: <Users className="h-4 w-4" />,
              onClick: () => setAssignmentDialogOpen(true),
            },
          ] : []}
        />
      </div>
    </PageLayout>
  );
}
