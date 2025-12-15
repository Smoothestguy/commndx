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
import { Eye, Clock, Briefcase, Bell, DollarSign, TrendingUp, ArrowLeft, CheckCircle2, XCircle, ExternalLink, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval, format } from "date-fns";
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
  const navigate = useNavigate();
  
  const { data: personnel, isLoading: personnelLoading } = usePersonnel();

  // Fetch time entries for selected personnel
  const { data: timeEntries, isLoading: timeLoading } = useQuery({
    queryKey: ["admin-preview-personnel-time", selectedPersonnelId],
    queryFn: async () => {
      if (!selectedPersonnelId) return [];
      const { data, error } = await supabase
        .from("time_entries")
        .select("id, entry_date, regular_hours, overtime_hours")
        .eq("personnel_id", selectedPersonnelId)
        .order("entry_date", { ascending: false });
      
      if (error) throw error;
      return (data || []) as TimeEntry[];
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
          projects(id, name, status)
        `)
        .eq("personnel_id", selectedPersonnelId)
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
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!selectedPersonnelId,
  });

  const selectedPerson = personnel?.find(p => p.id === selectedPersonnelId);
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
  const weeklyPay = weeklyHours * hourlyRate;
  const monthlyPay = monthlyHours * hourlyRate;
  const unreadNotifications = notifications?.filter(n => !n.is_read).length || 0;
  const activeProjects = assignments?.length || 0;

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
              <div>
                <h2 className="text-xl font-bold">
                  Welcome, {selectedPerson.first_name}!
                </h2>
                <p className="text-muted-foreground">
                  Here's an overview of your work activity
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/personnel/${selectedPersonnelId}`)}
                >
                  <User className="h-4 w-4 mr-2" />
                  View Personnel Record
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/time-tracking')}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  View Time Tracking
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/projects')}
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  View All Projects
                </Button>
              </div>

              {/* Stats Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card 
                  className="cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => navigate('/time-tracking')}
                >
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

                <Card 
                  className="cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => navigate(`/personnel/${selectedPersonnelId}`)}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Est. Weekly Pay</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoading ? "..." : `$${weeklyPay.toFixed(2)}`}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      @ ${hourlyRate.toFixed(2)}/hr
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => navigate('/projects')}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoading ? "..." : activeProjects}
                    </div>
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

              {/* Assigned Projects */}
              {assignments && assignments.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Assigned Projects</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
                      View All
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {assignments.slice(0, 5).map((assignment) => (
                        <div 
                          key={assignment.id} 
                          className="p-3 rounded-lg border cursor-pointer hover:bg-secondary/50 transition-colors group"
                          onClick={() => assignment.projects?.id && navigate(`/projects/${assignment.projects.id}`)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-primary group-hover:underline flex items-center gap-1">
                                {assignment.projects?.name || "Unknown Project"}
                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Assigned: {format(parseISO(assignment.assigned_at), "MMM d, yyyy")}
                              </p>
                            </div>
                            <span className="text-xs px-2 py-1 bg-secondary rounded">
                              {assignment.projects?.status || "active"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Notifications */}
              {notifications && notifications.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Notifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {notifications.map((notification) => (
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
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {!selectedPersonnelId && (
          <div className="text-center py-12 text-muted-foreground">
            Select a personnel member above to preview their portal experience
          </div>
        )}
      </div>
    </>
  );
}
