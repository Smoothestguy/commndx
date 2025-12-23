import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { SEO } from "@/components/SEO";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { SessionHistoryStats } from "@/components/session/SessionHistoryStats";
import { SessionHistoryTable } from "@/components/session/SessionHistoryTable";
import { SessionActivityTimeline } from "@/components/session/SessionActivityTimeline";
import { DevActivityDashboard } from "@/components/session/DevActivityDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfMonth, endOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const TARGET_USER_EMAIL = "chris.guevara97@gmail.com";
const TARGET_USER_ID = "a]"; // Will be fetched dynamically

export default function SessionHistory() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  // Fetch users who have session data (for admin selector)
  const { data: sessionUsers } = useQuery({
    queryKey: ["session-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_work_sessions")
        .select("user_id")
        .order("session_start", { ascending: false });
      
      if (error) throw error;
      
      // Get unique user IDs
      const uniqueUserIds = [...new Set(data.map(s => s.user_id))];
      
      // Fetch profiles for these users
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .in("id", uniqueUserIds);
      
      if (profileError) throw profileError;
      return profiles || [];
    },
    enabled: isAdmin || isManager,
  });

  // Set default target user when data loads
  useEffect(() => {
    if (user && !targetUserId) {
      // Default to current user if they're Chris, or first available user for admins
      if (user.email === TARGET_USER_EMAIL) {
        setTargetUserId(user.id);
      } else if ((isAdmin || isManager) && sessionUsers && sessionUsers.length > 0) {
        // Find Chris's ID or default to first user
        const chrisProfile = sessionUsers.find(p => p.email === TARGET_USER_EMAIL);
        setTargetUserId(chrisProfile?.id || sessionUsers[0].id);
      }
    }
  }, [user, isAdmin, isManager, sessionUsers, targetUserId]);

  // Allow access if user is Chris OR has admin/manager role
  const hasAccess = user?.email === TARGET_USER_EMAIL || isAdmin || isManager;

  if (roleLoading) {
    return null; // Or loading spinner
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  const canSelectUser = isAdmin || isManager;
  const effectiveUserId = targetUserId || user?.id || null;

  return (
    <>
      <SEO
        title="Session History"
        description="View your work session history and activity logs"
        keywords="session history, time tracking, activity log, work hours"
      />
      <DetailPageLayout
        title="Session History"
        subtitle="Review your work sessions, active time, and activity logs"
        backPath="/settings"
      >
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-between sm:items-center">
            {canSelectUser && sessionUsers && sessionUsers.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-sm text-muted-foreground">Viewing:</span>
                <Select value={targetUserId || ""} onValueChange={setTargetUserId}>
                  <SelectTrigger className="w-full sm:w-[250px]">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionUsers.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.first_name && profile.last_name 
                          ? `${profile.first_name} ${profile.last_name}` 
                          : profile.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="w-full sm:w-auto">
              <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            </div>
          </div>

          <Tabs defaultValue="sessions" className="space-y-4">
            <TabsList className="w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="sessions" className="text-xs sm:text-sm">Sessions</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
              <TabsTrigger value="dev-activities" className="text-xs sm:text-sm">Dev Activities</TabsTrigger>
            </TabsList>

            <TabsContent value="sessions">
              <SessionHistoryStats dateRange={dateRange} targetUserId={effectiveUserId} />
              <div className="mt-4">
                <SessionHistoryTable
                  dateRange={dateRange}
                  onSelectSession={setSelectedSessionId}
                  selectedSessionId={selectedSessionId}
                  targetUserId={effectiveUserId}
                />
              </div>
            </TabsContent>

            <TabsContent value="activity">
              <SessionActivityTimeline
                dateRange={dateRange}
                sessionId={selectedSessionId}
                targetUserId={effectiveUserId}
              />
            </TabsContent>

            <TabsContent value="dev-activities">
              <DevActivityDashboard dateRange={dateRange} targetUserId={effectiveUserId} />
            </TabsContent>
          </Tabs>
        </div>
      </DetailPageLayout>
    </>
  );
}