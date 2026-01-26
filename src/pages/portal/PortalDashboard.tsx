import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelTimeEntries, usePersonnelAssignments, usePersonnelReimbursements, usePersonnelNotifications } from "@/integrations/supabase/hooks/usePortal";
import { usePersonnelAssignedAssets } from "@/integrations/supabase/hooks/usePortalAssets";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useClockEnabledProjects, useAllOpenClockEntries } from "@/integrations/supabase/hooks/useTimeClock";
import { ClockStatusCard } from "@/components/portal/ClockStatusCard";
import { PortalAssetCard } from "@/components/portal/PortalAssetCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Briefcase, Receipt, Bell, TrendingUp, Calendar, Package } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval, format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { getLastCompletedPayPeriod, calculatePayPeriodTotals } from "@/lib/payPeriodUtils";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";

export default function PortalDashboard() {
  const navigate = useNavigate();
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();
  const { data: timeEntries, isLoading: timeLoading } = usePersonnelTimeEntries(personnel?.id);
  const { data: assignments, isLoading: assignmentsLoading } = usePersonnelAssignments(personnel?.id);
  const { data: reimbursements, isLoading: reimbursementsLoading } = usePersonnelReimbursements(personnel?.id);
  const { data: notifications } = usePersonnelNotifications(personnel?.id);
  const { data: companySettings } = useCompanySettings();
  const { data: assignedAssets, isLoading: assetsLoading } = usePersonnelAssignedAssets(personnel?.id);
  
  // Time clock data
  const { data: clockProjects, isLoading: clockProjectsLoading } = useClockEnabledProjects(personnel?.id);
  const { data: openClockEntries, isLoading: clockEntriesLoading } = useAllOpenClockEntries(personnel?.id);

  const isLoading = personnelLoading || timeLoading || assignmentsLoading || reimbursementsLoading || clockProjectsLoading || clockEntriesLoading || assetsLoading;
  
  // Get the active clock entry (if any)
  const activeClockEntry = openClockEntries?.[0] || null;
  
  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;
  const holidayMultiplier = companySettings?.holiday_multiplier ?? 2.0;

  // Calculate hours this week
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const weeklyHours = timeEntries?.reduce((total, entry) => {
    const entryDate = parseISO(entry.entry_date);
    if (isWithinInterval(entryDate, { start: weekStart, end: weekEnd })) {
      return total + (entry.regular_hours || 0) + (entry.overtime_hours || 0);
    }
    return total;
  }, 0) || 0;

  const monthlyHours = timeEntries?.reduce((total, entry) => {
    const entryDate = parseISO(entry.entry_date);
    if (isWithinInterval(entryDate, { start: monthStart, end: monthEnd })) {
      return total + (entry.regular_hours || 0) + (entry.overtime_hours || 0);
    }
    return total;
  }, 0) || 0;

  // Calculate last completed pay period (for Upcoming Payment card)
  const hourlyRate = personnel?.hourly_rate || 0;
  const lastPayPeriod = getLastCompletedPayPeriod();
  const lastPayPeriodTotals = timeEntries 
    ? calculatePayPeriodTotals(timeEntries, lastPayPeriod, hourlyRate, overtimeMultiplier, weeklyOvertimeThreshold, holidayMultiplier)
    : { regularHours: 0, overtimeHours: 0, holidayHours: 0, totalHours: 0, regularPay: 0, overtimePay: 0, holidayPay: 0, totalPay: 0, daysWorked: 0 };

  const monthlyPay = monthlyHours * hourlyRate;

  // Count pending reimbursements
  const pendingReimbursements = reimbursements?.filter(r => r.status === "pending").length || 0;

  // Count unread notifications
  const unreadNotifications = notifications?.filter(n => !n.is_read).length || 0;

  // Active projects count
  const activeProjects = assignments?.length || 0;

  // Assigned assets count
  const assetCount = assignedAssets?.length || 0;

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          {personnel && (
            <PersonnelAvatar
              photoUrl={personnel.photo_url}
              firstName={personnel.first_name}
              lastName={personnel.last_name}
              size="lg"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">
              Welcome, {personnel?.first_name}!
            </h1>
            <p className="text-muted-foreground">
              Here's an overview of your work activity
            </p>
          </div>
        </div>

        {/* Time Clock Card - Always show for personnel */}
        {personnel && (
          <ClockStatusCard
            personnelId={personnel.id}
            projects={clockProjects || []}
            activeEntry={activeClockEntry}
          />
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{weeklyHours.toFixed(1)}</div>
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
                {formatCurrency(lastPayPeriodTotals.totalPay)}
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
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/portal/projects')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeProjects}</div>
              <p className="text-xs text-muted-foreground">
                Currently assigned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notifications</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unreadNotifications}</div>
              <p className="text-xs text-muted-foreground">
                Unread messages
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
                <span className="font-medium">{monthlyHours.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Pay</span>
                <span className="font-medium">${monthlyPay.toFixed(2)}</span>
              </div>
              <Link to="/portal/hours">
                <Button variant="outline" className="w-full mt-2">
                  View All Hours
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Reimbursements
              </CardTitle>
              <CardDescription>Track your expense claims</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-medium">{pendingReimbursements}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Submitted</span>
                <span className="font-medium">{reimbursements?.length || 0}</span>
              </div>
              <Link to="/portal/reimbursements">
                <Button variant="outline" className="w-full mt-2">
                  Manage Reimbursements
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Assigned Assets */}
        {assetCount > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Assigned Assets
              </CardTitle>
              <CardDescription>
                {assetCount} item{assetCount !== 1 ? "s" : ""} assigned to you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignedAssets?.slice(0, 3).map((assignment) => (
                <PortalAssetCard 
                  key={assignment.id} 
                  assignment={assignment}
                  showProject={true}
                />
              ))}
              {assetCount > 3 && (
                <Link to="/portal/assets">
                  <Button variant="ghost" className="w-full">
                    View All Assets ({assetCount})
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        {notifications && notifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {notifications.slice(0, 3).map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-3 rounded-lg border ${!notification.is_read ? "bg-muted/50" : ""}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(notification.created_at), "MMM d")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {notifications.length > 3 && (
                <Link to="/portal/notifications">
                  <Button variant="ghost" className="w-full mt-4">
                    View All Notifications
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
