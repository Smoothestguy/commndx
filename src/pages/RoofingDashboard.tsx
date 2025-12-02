import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  CheckSquare, 
  FileWarning, 
  MessageSquare, 
  Plus,
  TrendingUp,
  Clock,
  DollarSign,
  AlertTriangle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useActivities } from "@/integrations/supabase/hooks/useActivities";
import { useAppointments } from "@/integrations/supabase/hooks/useAppointments";
import { useInsuranceClaims } from "@/integrations/supabase/hooks/useInsuranceClaims";
import { useTasks } from "@/integrations/supabase/hooks/useTasks";
import { format, isThisWeek, isPast, isToday, isTomorrow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function RoofingDashboard() {
  const navigate = useNavigate();
  const { data: activities } = useActivities();
  const { data: appointments } = useAppointments();
  const { data: claims } = useInsuranceClaims();
  const { data: tasks } = useTasks();

  // Calculate stats
  const thisWeekActivities = activities?.filter(a => isThisWeek(new Date(a.activity_date))).length || 0;
  
  const upcomingAppointments = appointments?.filter(
    a => !isPast(new Date(a.end_time)) && a.status !== "completed" && a.status !== "cancelled"
  ) || [];
  const todayAppointments = upcomingAppointments.filter(a => isToday(new Date(a.start_time)));
  
  const activeClaims = claims?.filter(c => !["completed", "denied"].includes(c.status)) || [];
  const totalApprovedAmount = claims?.filter(c => c.status === "approved" || c.status === "completed")
    .reduce((sum, c) => sum + (c.approved_amount || 0), 0) || 0;
  
  const pendingTasks = tasks?.filter(t => t.status !== "completed" && t.status !== "cancelled") || [];
  const overdueTasks = pendingTasks.filter(t => t.due_date && isPast(new Date(t.due_date)));

  const recentActivities = activities?.slice(0, 5) || [];

  return (
    <PageLayout
      title="Roofing Dashboard"
      description="Overview of your roofing CRM activities"
    >
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate("/activities")} variant="outline" size="sm">
            <MessageSquare className="h-4 w-4 mr-2" />
            Log Activity
          </Button>
          <Button onClick={() => navigate("/appointments")} variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
          <Button onClick={() => navigate("/tasks")} variant="outline" size="sm">
            <CheckSquare className="h-4 w-4 mr-2" />
            Create Task
          </Button>
          <Button onClick={() => navigate("/insurance-claims")} variant="outline" size="sm">
            <FileWarning className="h-4 w-4 mr-2" />
            File Claim
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today's Appointments</p>
                  <p className="text-2xl font-bold">{todayAppointments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overdue Tasks</p>
                  <p className="text-2xl font-bold">{overdueTasks.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <FileWarning className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Claims</p>
                  <p className="text-2xl font-bold">{activeClaims.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Claims Approved</p>
                  <p className="text-2xl font-bold">${totalApprovedAmount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upcoming Appointments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/appointments")}>
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming appointments
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.slice(0, 5).map((appointment) => (
                    <div key={appointment.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{appointment.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {appointment.customer?.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          {isToday(new Date(appointment.start_time)) 
                            ? "Today" 
                            : isTomorrow(new Date(appointment.start_time))
                            ? "Tomorrow"
                            : format(new Date(appointment.start_time), "MMM d")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(appointment.start_time), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Pending Tasks</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")}>
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No pending tasks
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingTasks.slice(0, 5).map((task) => {
                    const isOverdue = task.due_date && isPast(new Date(task.due_date));
                    return (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={
                              task.priority === "urgent" ? "bg-red-500/10 text-red-500" :
                              task.priority === "high" ? "bg-orange-500/10 text-orange-500" :
                              "bg-gray-500/10 text-gray-500"
                            }
                          >
                            {task.priority}
                          </Badge>
                          <p className="font-medium text-sm">{task.title}</p>
                        </div>
                        {task.due_date && (
                          <p className={`text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                            {isOverdue ? "Overdue" : format(new Date(task.due_date), "MMM d")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activities */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Recent Activities</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/activities")}>
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {recentActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent activities
                </p>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{activity.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.customer?.name} • {activity.activity_type.replace("_", " ")}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.activity_date), "MMM d")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Claims */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Active Claims</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/insurance-claims")}>
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {activeClaims.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No active claims
                </p>
              ) : (
                <div className="space-y-3">
                  {activeClaims.slice(0, 5).map((claim) => (
                    <div key={claim.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">
                          {claim.claim_number || "Pending #"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {claim.customer?.name} • {claim.insurance_company}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {claim.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
