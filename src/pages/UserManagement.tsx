import { useEffect, useState } from "react";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Plus, X, Send, Clock, RefreshCw, XCircle, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Database } from "@/integrations/supabase/types";
import { NotificationPreferences } from "@/components/user-management/NotificationPreferences";
import { shouldNotifyForEvent, triggerNotification } from "@/utils/notificationUtils";
import { exportToCSV, exportToJSON } from "@/utils/exportUtils";
import { UserCard } from "@/components/user-management/UserCard";
import { UserStats } from "@/components/user-management/UserStats";
import { InvitationCard } from "@/components/user-management/InvitationCard";
import { InvitationEmptyState } from "@/components/user-management/InvitationEmptyState";
import { ActivityLogCard } from "@/components/user-management/ActivityLogCard";
import { ActivityEmptyState } from "@/components/user-management/ActivityEmptyState";
import { ActivityFilters } from "@/components/user-management/ActivityFilters";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  role: AppRole | null;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
  expires_at: string;
  status: string;
  token: string;
}

export default function UserManagement() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("user");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<any>(null);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const activityPerPage = 50;
  
  // Activity log filters
  const [emailFilter, setEmailFilter] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/");
      toast({
        title: "Access denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
    }
  }, [isAdmin, roleLoading, navigate, toast]);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      
      if (user?.id) {
        // Fetch notification preferences
        const { data: prefs } = await supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        
        setNotificationPreferences(prefs);
      }
    };
    getCurrentUser();
    fetchUsers();
    fetchInvitations();
    fetchActivityLogs();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setActivityPage(1);
  }, [emailFilter, actionFilter, dateFromFilter, dateToFilter]);

  // Fetch activity logs when page or filters change
  useEffect(() => {
    fetchActivityLogs();
  }, [activityPage]);

  // Real-time subscription for invitation activity
  useEffect(() => {
    const channel = supabase
      .channel('invitation-activity-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'invitation_activity_log'
        },
        (payload) => {
          const newLog = payload.new as any;
          
          // Only show notifications for important events from other users
          if (newLog.performed_by !== currentUserId) {
            // Check if we should notify for this event
            if (!shouldNotifyForEvent(newLog.action, notificationPreferences)) {
              return;
            }

            const getNotificationMessage = () => {
              switch (newLog.action) {
                case 'accepted':
                  return {
                    title: "Invitation Accepted",
                    description: `${newLog.target_email} has accepted their invitation as ${newLog.target_role}`,
                  };
                case 'expired':
                  return {
                    title: "Invitation Expired",
                    description: `Invitation for ${newLog.target_email} has expired`,
                    variant: "destructive" as const,
                  };
                case 'cancelled':
                  return {
                    title: "Invitation Cancelled",
                    description: `Invitation for ${newLog.target_email} was cancelled by ${newLog.performed_by_email}`,
                  };
                case 'reminder_sent':
                  return {
                    title: "Expiry Reminder Sent",
                    description: `Reminder sent for ${newLog.target_email}'s invitation`,
                  };
                case 'sent':
                  return {
                    title: "Invitation Sent",
                    description: `New invitation sent to ${newLog.target_email} as ${newLog.target_role}`,
                  };
                case 'resent':
                  return {
                    title: "Invitation Resent",
                    description: `Invitation resent to ${newLog.target_email}`,
                  };
                default:
                  return null;
              }
            };

            const notification = getNotificationMessage();
            if (notification) {
              triggerNotification(notification, notificationPreferences, toast);
            }
          }
          
          // Refresh the activity log to show the new entry
          fetchActivityLogs();
          
          // If it's an accepted event, refresh users list
          if (newLog.action === 'accepted') {
            fetchUsers();
          }
          
          // If it's cancelled or expired, refresh invitations
          if (newLog.action === 'cancelled' || newLog.action === 'expired') {
            fetchInvitations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, notificationPreferences, toast]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, created_at")
        .order("created_at", { ascending: true });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role || null,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error loading users",
        description: "Failed to load user list. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setUpdatingUserId(userId);
    try {
      // First, delete existing role
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Then insert new role
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });

      if (error) throw error;

      toast({
        title: "Role updated",
        description: `User role has been changed to ${newRole}.`,
      });

      // Refresh user list
      await fetchUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        title: "Error updating role",
        description: error.message || "Failed to update user role. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingInvite(true);

    try {
      // Generate a secure token
      const token = crypto.randomUUID();

      // Create invitation record
      const { data: invitationData, error: inviteError } = await supabase
        .from("invitations")
        .insert({
          email: inviteEmail,
          role: inviteRole,
          token: token,
          invited_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      // Send invitation email via edge function
      const { error: emailError } = await supabase.functions.invoke("send-invitation", {
        body: {
          email: inviteEmail,
          role: inviteRole,
          invitationId: invitationData.id,
          token: token,
        },
      });

      if (emailError) throw emailError;

      // Log sent event
      await logInvitationActivity(invitationData.id, 'sent', inviteEmail, inviteRole);

      toast({
        title: "Invitation sent!",
        description: `An invitation email has been sent to ${inviteEmail}.`,
      });

      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("user");
      
      // Refresh invitations list
      await fetchInvitations();
      await fetchActivityLogs();
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      toast({
        title: "Error sending invitation",
        description: error.message || "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const logInvitationActivity = async (
    invitationId: string,
    action: 'sent' | 'resent' | 'cancelled',
    targetEmail: string,
    targetRole: AppRole
  ) => {
    try {
      if (!currentUserId) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', currentUserId)
        .single();

      await supabase.from('invitation_activity_log').insert({
        invitation_id: invitationId,
        action,
        performed_by: currentUserId,
        performed_by_email: profile?.email || 'Unknown',
        target_email: targetEmail,
        target_role: targetRole,
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const fetchActivityLogs = async () => {
    setLoadingActivityLogs(true);
    try {
      // Get total count with filters
      let countQuery = supabase
        .from("invitation_activity_log")
        .select("*", { count: "exact", head: true });

      if (emailFilter) {
        countQuery = countQuery.ilike("target_email", `%${emailFilter}%`);
      }
      if (actionFilter && actionFilter !== "all") {
        countQuery = countQuery.eq("action", actionFilter);
      }
      if (dateFromFilter) {
        const fromDate = new Date(dateFromFilter);
        fromDate.setHours(0, 0, 0, 0);
        countQuery = countQuery.gte("created_at", fromDate.toISOString());
      }
      if (dateToFilter) {
        const toDate = new Date(dateToFilter);
        toDate.setHours(23, 59, 59, 999);
        countQuery = countQuery.lte("created_at", toDate.toISOString());
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setActivityTotal(count || 0);

      // Get paginated data
      const from = (activityPage - 1) * activityPerPage;
      const to = from + activityPerPage - 1;

      let query = supabase
        .from("invitation_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      // Apply filters
      if (emailFilter) {
        query = query.ilike("target_email", `%${emailFilter}%`);
      }

      if (actionFilter && actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      if (dateFromFilter) {
        const fromDate = new Date(dateFromFilter);
        fromDate.setHours(0, 0, 0, 0);
        query = query.gte("created_at", fromDate.toISOString());
      }

      if (dateToFilter) {
        const toDate = new Date(dateToFilter);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte("created_at", toDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setActivityLogs(data || []);
    } catch (error: any) {
      console.error("Error fetching activity logs:", error);
      toast({
        title: "Error",
        description: "Failed to load activity logs",
        variant: "destructive",
      });
    } finally {
      setLoadingActivityLogs(false);
    }
  };

  const fetchInvitations = async () => {
    setLoadingInvitations(true);
    try {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, created_at, expires_at, status, token")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      toast({
        title: "Error loading invitations",
        description: "Failed to load pending invitations.",
        variant: "destructive",
      });
    } finally {
      setLoadingInvitations(false);
    }
  };

  const handleResendInvitation = async (invitation: PendingInvitation) => {
    setProcessingInviteId(invitation.id);
    try {
      const { error } = await supabase.functions.invoke("send-invitation", {
        body: {
          email: invitation.email,
          role: invitation.role,
          invitationId: invitation.id,
          token: invitation.token,
        },
      });

      if (error) throw error;

      // Log resent event
      await logInvitationActivity(invitation.id, 'resent', invitation.email, invitation.role);

      toast({
        title: "Invitation resent",
        description: `Invitation email has been resent to ${invitation.email}.`,
      });
      
      await fetchActivityLogs();
    } catch (error: any) {
      console.error("Error resending invitation:", error);
      toast({
        title: "Error resending invitation",
        description: error.message || "Failed to resend invitation.",
        variant: "destructive",
      });
    } finally {
      setProcessingInviteId(null);
    }
  };

  const handleCancelInvitation = async (invitation: PendingInvitation) => {
    setProcessingInviteId(invitation.id);
    try {
      const { error } = await supabase
        .from("invitations")
        .update({ status: "cancelled" })
        .eq("id", invitation.id);

      if (error) throw error;

      // Log cancelled event
      await logInvitationActivity(invitation.id, 'cancelled', invitation.email, invitation.role);

      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled.",
      });

      await fetchInvitations();
      await fetchActivityLogs();
    } catch (error: any) {
      console.error("Error cancelling invitation:", error);
      toast({
        title: "Error cancelling invitation",
        description: error.message || "Failed to cancel invitation.",
        variant: "destructive",
      });
    } finally {
      setProcessingInviteId(null);
    }
  };

  const getRoleBadgeVariant = (role: AppRole | null) => {
    if (role === "admin") return "default";
    if (role === "manager") return "secondary";
    return "outline";
  };

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return "Expired";
    if (daysLeft === 0) return "Expires today";
    if (daysLeft === 1) return "Expires tomorrow";
    return `Expires in ${daysLeft} days`;
  };

  if (roleLoading || loading) {
    return (
      <PageLayout title="User Management" description="Manage users and their roles">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <SEO 
        title="User Management"
        description="Manage team members and permissions"
        keywords="user management, team management, roles, permissions, invitations"
        noIndex={true}
      />
      <PageLayout
      title="User Management"
      description="Manage users and their roles"
    >
      <div className="space-y-6">
        {/* Stats Section */}
        <UserStats users={users} />

        <Tabs defaultValue="users" className="w-full">
          <TabsList className={isMobile ? "flex w-full overflow-x-auto" : "grid w-full max-w-2xl grid-cols-4"}>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="invitations">
              Invitations {invitations.length > 0 && `(${invitations.length})`}
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>
                    View and manage user roles. Admins have full access, managers can manage most resources, and users have limited access.
                  </CardDescription>
                </div>
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite New User</DialogTitle>
                  <DialogDescription>
                    Send an invitation email to a new user with a pre-assigned role.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSendInvitation} className="space-y-4">
                  <div>
                    <Label htmlFor="invite-email">Email Address</Label>
                    <div className="relative mt-1.5">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="invite-email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="invite-role">Role</Label>
                    <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as AppRole)}>
                      <SelectTrigger id="invite-role" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSendingInvite}>
                      {isSendingInvite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send Invitation
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No users found.</p>
            ) : isMobile ? (
              <div className="grid grid-cols-1 gap-4">
                {users.map((user, index) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onRoleChange={handleRoleChange}
                    isUpdating={updatingUserId === user.id}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {users.map((user) => (
                  <div key={user.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="font-medium truncate">
                            {user.first_name && user.last_name
                              ? `${user.first_name} ${user.last_name}`
                              : user.email}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role || "No role"}
                      </Badge>
                      <Select
                        value={user.role || ""}
                        onValueChange={(value) => handleRoleChange(user.id, value as AppRole)}
                        disabled={updatingUserId === user.id}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Change role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                      {updatingUserId === user.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="invitations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>
                  Manage pending user invitations. You can resend or cancel invitations before they are accepted.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingInvitations ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : invitations.length === 0 ? (
                  <InvitationEmptyState />
                ) : isMobile ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {invitations.map((invitation, index) => (
                      <InvitationCard
                        key={invitation.id}
                        invitation={invitation}
                        onResend={handleResendInvitation}
                        onCancel={handleCancelInvitation}
                        isProcessing={processingInviteId === invitation.id}
                        index={index}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="border rounded-lg divide-y">
                    {invitations.map((invitation) => (
                      <div key={invitation.id} className="p-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-medium truncate">{invitation.email}</p>
                            <Badge variant={getRoleBadgeVariant(invitation.role)}>
                              {invitation.role}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {getTimeUntilExpiry(invitation.expires_at)}
                            </span>
                            <span>
                              Sent {new Date(invitation.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendInvitation(invitation)}
                            disabled={processingInviteId === invitation.id}
                          >
                            {processingInviteId === invitation.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="mr-2 h-4 w-4" />
                                Resend
                              </>
                            )}
                          </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelInvitation(invitation)}
                              disabled={processingInviteId === invitation.id}
                            >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Invitation Activity Log</CardTitle>
                  <CardDescription>
                    Timeline of all invitation-related events
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      try {
                        const filename = `activity-logs-${new Date().toISOString().split('T')[0]}`;
                        exportToCSV(activityLogs, filename);
                        toast({
                          title: "Export successful",
                          description: "Activity logs exported as CSV",
                        });
                      } catch (error: any) {
                        toast({
                          title: "Export failed",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={activityLogs.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      try {
                        const filename = `activity-logs-${new Date().toISOString().split('T')[0]}`;
                        exportToJSON(activityLogs, filename);
                        toast({
                          title: "Export successful",
                          description: "Activity logs exported as JSON",
                        });
                      } catch (error: any) {
                        toast({
                          title: "Export failed",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={activityLogs.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export JSON
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filter Controls */}
                <ActivityFilters
                  emailFilter={emailFilter}
                  actionFilter={actionFilter}
                  dateFromFilter={dateFromFilter}
                  dateToFilter={dateToFilter}
                  onEmailFilterChange={setEmailFilter}
                  onActionFilterChange={setActionFilter}
                  onDateFromFilterChange={setDateFromFilter}
                  onDateToFilterChange={setDateToFilter}
                  onApply={fetchActivityLogs}
                  onClear={() => {
                    setEmailFilter("");
                    setActionFilter("all");
                    setDateFromFilter("");
                    setDateToFilter("");
                    setTimeout(fetchActivityLogs, 0);
                  }}
                  hasActiveFilters={
                    emailFilter !== "" ||
                    actionFilter !== "all" ||
                    dateFromFilter !== "" ||
                    dateToFilter !== ""
                  }
                />
                {loadingActivityLogs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : activityLogs.length === 0 ? (
                  <ActivityEmptyState />
                 ) : isMobile ? (
                   <div className="space-y-4">
                      {activityLogs.map((log, index) => (
                        <ActivityLogCard key={log.id} log={log} index={index} />
                      ))}
                      {/* Pagination Controls */}
                      {activityTotal > activityPerPage && (
                       <div className="flex items-center justify-between pt-4 border-t">
                         <p className="text-sm text-muted-foreground">
                           Showing {((activityPage - 1) * activityPerPage) + 1} to {Math.min(activityPage * activityPerPage, activityTotal)} of {activityTotal} results
                         </p>
                         <div className="flex gap-2">
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                             disabled={activityPage === 1}
                           >
                             Previous
                           </Button>
                           <div className="flex items-center gap-2 px-3">
                             <span className="text-sm">
                               Page {activityPage} of {Math.ceil(activityTotal / activityPerPage)}
                             </span>
                           </div>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => setActivityPage(p => p + 1)}
                             disabled={activityPage * activityPerPage >= activityTotal}
                           >
                             Next
                           </Button>
                         </div>
                       </div>
                      )}
                    </div>
                 ) : (
                   <div className="space-y-4">
                      {activityLogs.map((log) => {
                        const getActionIcon = () => {
                          switch (log.action) {
                            case 'sent':
                              return <Mail className="h-4 w-4 text-blue-500" />;
                            case 'resent':
                              return <RefreshCw className="h-4 w-4 text-orange-500" />;
                            case 'accepted':
                              return <CheckCircle2 className="h-4 w-4 text-green-500" />;
                            case 'cancelled':
                              return <XCircle className="h-4 w-4 text-red-500" />;
                            case 'reminder_sent':
                              return <Clock className="h-4 w-4 text-yellow-500" />;
                            case 'expired':
                              return <AlertCircle className="h-4 w-4 text-gray-500" />;
                            default:
                              return <Mail className="h-4 w-4" />;
                          }
                        };

                        const getActionLabel = () => {
                          switch (log.action) {
                            case 'sent':
                              return 'Invitation Sent';
                            case 'resent':
                              return 'Invitation Resent';
                            case 'accepted':
                              return 'Invitation Accepted';
                            case 'cancelled':
                              return 'Invitation Cancelled';
                            case 'reminder_sent':
                              return 'Expiry Reminder Sent';
                            case 'expired':
                              return 'Invitation Expired';
                            default:
                              return log.action;
                          }
                        };

                        return (
                          <div
                            key={log.id}
                            className="flex items-start gap-4 p-4 rounded-lg border bg-card"
                          >
                            <div className="mt-1">{getActionIcon()}</div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{getActionLabel()}</p>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(log.created_at).toLocaleDateString()} at{' '}
                                  {new Date(log.created_at).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">{log.target_email}</span>
                                {' • '}
                                <Badge variant="outline" className="capitalize">
                                  {log.target_role}
                                </Badge>
                              </div>
                              {log.performed_by_email && (
                                <p className="text-xs text-muted-foreground">
                                  By: {log.performed_by_email}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Pagination Controls */}
                      {activityTotal > activityPerPage && (
                        <div className="flex items-center justify-between pt-4 border-t">
                          <p className="text-sm text-muted-foreground">
                            Showing {((activityPage - 1) * activityPerPage) + 1} to {Math.min(activityPage * activityPerPage, activityTotal)} of {activityTotal} results
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                              disabled={activityPage === 1}
                            >
                              Previous
                            </Button>
                            <div className="flex items-center gap-2 px-3">
                              <span className="text-sm">
                                Page {activityPage} of {Math.ceil(activityTotal / activityPerPage)}
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActivityPage(p => p + 1)}
                              disabled={activityPage * activityPerPage >= activityTotal}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
               </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            {currentUserId && (
              <NotificationPreferences 
                userId={currentUserId} 
                onSave={(prefs) => setNotificationPreferences(prefs)}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
    </>
  );
}
