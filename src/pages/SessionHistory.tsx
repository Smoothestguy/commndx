import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissionCheck } from "@/hooks/usePermissionCheck";
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

export default function SessionHistory() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const { canView: hasUserMgmtPermission, loading: permLoading } = usePermissionCheck("user_management");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  // Fetch users who have session data (for admin selector) and their roles
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

      // Fetch roles for these users
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", uniqueUserIds);

      // Map roles to user IDs
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      return (profiles || []).map(p => ({
        ...p,
        role: roleMap.get(p.id) || null
      }));
    },
    enabled: isAdmin || isManager,
  });

  // Set default target user when data loads
  useEffect(() => {
    if (user && !targetUserId) {
      // Default to current user, or first available user for admins/managers
      if ((isAdmin || isManager) && sessionUsers && sessionUsers.length > 0) {
        // Default to first user with sessions
        setTargetUserId(sessionUsers[0].id);
      } else {
        setTargetUserId(user.id);
      }
    }
  }, [user, isAdmin, isManager, sessionUsers, targetUserId]);

  // Allow access if user has admin/manager role OR user_management permission
  const hasAccess = isAdmin || isManager || hasUserMgmtPermission;

  if (roleLoading || permLoading) {
    return null; // Or loading spinner
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  const canSelectUser = isAdmin || isManager;
  const effectiveUserId = targetUserId || user?.id || null;
  
  // Get the email of the target user for session creation
  const targetUserEmail = effectiveUserId === user?.id 
    ? user?.email 
    : sessionUsers?.find(u => u.id === effectiveUserId)?.email;

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
                  targetUserEmail={targetUserEmail}
                  isAdmin={isAdmin}
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