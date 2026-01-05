import { useState, useMemo } from "react";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersonnel } from "@/integrations/supabase/hooks/usePersonnel";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Eye, Clock, Briefcase, Bell, DollarSign, TrendingUp, ArrowLeft, CheckCircle2, XCircle, User, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";
import { Link, useNavigate } from "react-router-dom";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval, format } from "date-fns";
import { ProjectPreviewDialog } from "@/components/admin/ProjectPreviewDialog";
import { UserActivityHistory } from "@/components/admin/UserActivityHistory";
import { useUserActivityLogs } from "@/integrations/supabase/hooks/useUserActivityLogs";
import { formatCurrency } from "@/lib/utils";
import { useAllOpenClockEntries } from "@/integrations/supabase/hooks/useTimeClock";
import { InlineClockControls } from "@/components/portal/InlineClockControls";
import { getLastCompletedPayPeriod, calculatePayPeriodTotals } from "@/lib/payPeriodUtils";
interface TimeEntry {
  id: string;
  entry_date: string;
  regular_hours: number | null;
  overtime_hours: number | null;
}

interface Assignment {
  id: string;
  assigned_at: string;
  projects: {
    id: string;
    name: string;
    status: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    start_date?: string;
    end_date?: string;
    time_clock_enabled?: boolean;
    require_clock_location?: boolean;
    customer?: {
      name: string;
      company?: string;
    };
  } | null;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function PersonnelPortalPreview() {
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>("");
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Assignment | null>(null);
  const navigate = useNavigate();
  
  const { data: personnel, isLoading: personnelLoading } = usePersonnel();
  
  // Fetch all open clock entries for this personnel
  const { data: openClockEntries } = useAllOpenClockEntries(selectedPersonnelId || undefined);
  const hasOtherOpenEntry = (projectId: string) => 
    openClockEntries?.some(e => e.project_id !== projectId) ?? false;

  // Fetch time entries for selected personnel
  const { data: timeEntries, isLoading: timeLoading } = useQuery({
    queryKey: ["admin-preview-personnel-time", selectedPersonnelId],
    queryFn: async () => {
      if (!selectedPersonnelId) return [];
      const { data, error } = await supabase
        .from("time_entries")
        .select("id, entry_date, regular_hours, overtime_hours, project_id, is_holiday, hourly_rate")
        .eq("personnel_id", selectedPersonnelId)
        .order("entry_date", { ascending: false });
      
      if (error) throw error;
      return (data || []) as (TimeEntry & { project_id: string; is_holiday?: boolean; hourly_rate?: number })[];
    },
    enabled: !!selectedPersonnelId,
  });

  // Fetch assignments for selected personnel
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["admin-preview-personnel-assignments", selectedPersonnelId],
    queryFn: async () => {
      if (!selectedPersonnelId) return [];
      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .select(`
          id,
          assigned_at,
          projects(
            id, 
            name, 
            status, 
            address, 
            city, 
            state, 
            zip, 
            start_date, 
            end_date,
            time_clock_enabled,
            require_clock_location,
            customer:customers(name, company)
          )
        `)
        .eq("personnel_id", selectedPersonnelId)
        .eq("status", "active")
        .order("assigned_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as Assignment[];
    },
    enabled: !!selectedPersonnelId,
  });

  // Fetch notifications for selected personnel
  const { data: notifications } = useQuery({
    queryKey: ["admin-preview-personnel-notifications", selectedPersonnelId],
    queryFn: async () => {
      if (!selectedPersonnelId) return [];
      const { data, error } = await supabase
        .from("personnel_notifications")
        .select("id, title, message, is_read, created_at")
        .eq("personnel_id", selectedPersonnelId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!selectedPersonnelId,
  });

  const selectedPerson = personnel?.find(p => p.id === selectedPersonnelId);

  // Fetch activity logs for selected personnel
  const { data: activityLogs, isLoading: activityLoading } = useUserActivityLogs({
    userId: selectedPerson?.user_id || undefined,
    personnelId: selectedPersonnelId || undefined,
  });

  const isLoading = timeLoading || assignmentsLoading;

  // Calculate hours
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const weeklyHours = useMemo(() => {
    return timeEntries?.reduce((total, entry) => {
      const entryDate = parseISO(entry.entry_date);
      if (isWithinInterval(entryDate, { start: weekStart, end: weekEnd })) {
        return total + (entry.regular_hours || 0) + (entry.overtime_hours || 0);
      }
      return total;
    }, 0) || 0;
  }, [timeEntries, weekStart, weekEnd]);

  const monthlyHours = useMemo(() => {
    return timeEntries?.reduce((total, entry) => {
      const entryDate = parseISO(entry.entry_date);
      if (isWithinInterval(entryDate, { start: monthStart, end: monthEnd })) {
        return total + (entry.regular_hours || 0) + (entry.overtime_hours || 0);
      }
      return total;
    }, 0) || 0;
  }, [timeEntries, monthStart, monthEnd]);

  const hourlyRate = selectedPerson?.hourly_rate || 0;
  
  // Calculate last completed pay period for Upcoming Payment card
  const lastPayPeriod = getLastCompletedPayPeriod();
  const lastPayPeriodTotals = useMemo(() => {
    if (!timeEntries) return { regularHours: 0, overtimeHours: 0, totalHours: 0, regularPay: 0, overtimePay: 0, totalPay: 0, daysWorked: 0, dailyBreakdown: [] };
    return calculatePayPeriodTotals(timeEntries, lastPayPeriod, hourlyRate, 1.5);
  }, [timeEntries, lastPayPeriod, hourlyRate]);
  
  const monthlyPay = monthlyHours * hourlyRate;
  const unreadNotifications = notifications?.filter(n => !n.is_read).length || 0;
  const activeProjects = assignments?.length || 0;

  const displayedProjects = showAllProjects ? assignments : assignments?.slice(0, 5);
  const displayedNotifications = showAllNotifications ? notifications : notifications?.slice(0, 5);

  return (
    <>
      <SEO
        title="Personnel Portal Preview"
        description="Preview what personnel see in their portal"
      />
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/personnel">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Eye className="h-6 w-6" />
              Personnel Portal Preview
            </h1>
            <p className="text-muted-foreground">
              View what personnel see when they log into their portal
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Personnel</CardTitle>
            <CardDescription>
              Choose a personnel member to preview their portal experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            {personnelLoading ? (
              <Skeleton className="h-10 w-full max-w-md" />
            ) : (
              <>
                <Select value={selectedPersonnelId} onValueChange={setSelectedPersonnelId}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Select personnel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {personnel?.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        <div className="flex items-center gap-2">
                          {person.user_id ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span>{person.first_name} {person.last_name}</span>
                          <span className="text-muted-foreground">({person.personnel_number})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" /> Has account
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-muted-foreground" /> No account
                  </span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {selectedPersonnelId && selectedPerson && (
          <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 space-y-6">
            <Alert className={selectedPerson.user_id ? "border-green-500/50" : "border-amber-500/50"}>
              <Eye className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-1">
                <span>
                  You are previewing the portal as <strong>{selectedPerson.first_name} {selectedPerson.last_name}</strong>.
                </span>
                {selectedPerson.user_id ? (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    This employee has portal access ({selectedPerson.email})
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <XCircle className="h-3 w-3" />
                    This employee has not created an account yet
                  </span>
                )}
              </AlertDescription>
            </Alert>

            {/* Personnel Dashboard Preview */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <PersonnelAvatar
                  photoUrl={selectedPerson.photo_url}
                  firstName={selectedPerson.first_name}
                  lastName={selectedPerson.last_name}
                  size="lg"
                />
                <div>
                  <h2 className="text-xl font-bold">
                    Welcome, {selectedPerson.first_name}!
                  </h2>
                  <p className="text-muted-foreground">
                    Here's an overview of your work activity
                  </p>
                </div>
              </div>

              {/* Admin Quick Action - Only this navigates away */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/personnel/${selectedPersonnelId}`)}
                >
                  <User className="h-4 w-4 mr-2" />
                  View Personnel Record (Admin)
                </Button>
              </div>

              {/* Stats Grid - Now with inline toggle actions */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoading ? "..." : weeklyHours.toFixed(1)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Upcoming Payment</CardTitle>
                    <Calendar className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {isLoading ? "..." : formatCurrency(lastPayPeriodTotals.totalPay)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pay Period: {lastPayPeriod.label}
                    </p>
                    <p className="text-xs text-primary font-medium">
                      Paid: {format(lastPayPeriod.paymentDate, "EEE, MMM d")}
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => setShowAllProjects(!showAllProjects)}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoading ? "..." : activeProjects}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      Click to {showAllProjects ? "collapse" : "expand"}
                      {showAllProjects ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => setShowAllNotifications(!showAllNotifications)}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Notifications</CardTitle>
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{unreadNotifications}</div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      Click to {showAllNotifications ? "collapse" : "expand"}
                      {showAllNotifications ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Secondary Stats */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Monthly Summary
                    </CardTitle>
                    <CardDescription>{format(now, "MMMM yyyy")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Hours</span>
                      <span className="font-medium">
                        {isLoading ? "..." : `${monthlyHours.toFixed(1)} hrs`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated Pay</span>
                      <span className="font-medium">
                        {isLoading ? "..." : `$${monthlyPay.toFixed(2)}`}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Project Assignments
                    </CardTitle>
                    <CardDescription>Currently assigned projects</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active</span>
                      <span className="font-medium">
                        {isLoading ? "..." : activeProjects}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Hours Logged</span>
                      <span className="font-medium">
                        {isLoading ? "..." : timeEntries?.length || 0} entries
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Assigned Projects - Self-contained with dialog */}
              {assignments && assignments.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Assigned Projects</CardTitle>
                    {assignments.length > 5 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowAllProjects(!showAllProjects)}
                      >
                        {showAllProjects ? "Show Less" : `View All (${assignments.length})`}
                        {showAllProjects ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {displayedProjects?.map((assignment) => (
                        <div 
                          key={assignment.id} 
                          className="p-3 rounded-lg border hover:bg-secondary/50 transition-colors group"
                        >
                          <div 
                            className="flex justify-between items-start cursor-pointer"
                            onClick={() => setSelectedProject(assignment)}
                          >
                            <div>
                              <p className="font-medium text-primary group-hover:underline">
                                {assignment.projects?.name || "Unknown Project"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Assigned: {format(parseISO(assignment.assigned_at), "MMM d, yyyy")}
                              </p>
                            </div>
                            <span className="text-xs px-2 py-1 bg-secondary rounded">
                              {assignment.projects?.status || "unknown"}
                            </span>
                          </div>
                          
                          {/* Clock In/Out controls for clock-enabled projects */}
                          {assignment.projects?.time_clock_enabled && (
                            <InlineClockControls
                              project={{
                                id: assignment.projects.id,
                                name: assignment.projects.name,
                                require_clock_location: assignment.projects.require_clock_location,
                              }}
                              personnelId={selectedPersonnelId}
                              hasOtherOpenEntry={hasOtherOpenEntry(assignment.projects.id)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Notifications - Self-contained */}
              {notifications && notifications.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Notifications
                    </CardTitle>
                    {notifications.length > 5 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowAllNotifications(!showAllNotifications)}
                      >
                        {showAllNotifications ? "Show Less" : `View All (${notifications.length})`}
                        {showAllNotifications ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {displayedNotifications?.map((notification) => (
                        <div 
                          key={notification.id} 
                          className={`p-3 rounded-lg border ${
                            notification.is_read ? "opacity-60" : "bg-primary/5 border-primary/20"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{notification.title}</p>
                              <p className="text-sm text-muted-foreground">{notification.message}</p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(parseISO(notification.created_at), "MMM d")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Activity History */}
              <UserActivityHistory
                logs={activityLogs}
                isLoading={activityLoading}
                title="Activity History"
                description={`All actions by or related to ${selectedPerson.first_name} ${selectedPerson.last_name}`}
                maxHeight="350px"
              />
            </div>
          </div>
        )}

        {!selectedPersonnelId && (
          <div className="text-center py-12 text-muted-foreground">
            Select a personnel member above to preview their portal experience
          </div>
        )}
      </div>

      {/* Project Detail Dialog */}
      <ProjectPreviewDialog
        project={selectedProject?.projects || null}
        open={!!selectedProject}
        onClose={() => setSelectedProject(null)}
        assignedAt={selectedProject?.assigned_at}
        timeEntries={timeEntries?.filter(e => e.project_id === selectedProject?.projects?.id) || []}
        hourlyRate={selectedPerson?.hourly_rate || null}
      />
    </>
  );
}
