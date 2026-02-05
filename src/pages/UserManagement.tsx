import { useEffect, useState } from "react";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissionCheck } from "@/hooks/usePermissionCheck";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Plus, X, Send, Clock, RefreshCw, XCircle, CheckCircle2, AlertCircle, Download, User, Eye, EyeOff, Link, Trash2, MoreVertical } from "lucide-react";
import { MobileActionBar, ActionButton } from "@/components/layout/MobileActionBar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
import { TimeClockAdminTab } from "@/components/user-management/TimeClockAdminTab";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  role: AppRole | null;
  personnel_id?: string | null;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
  expires_at: string;
  status: string;
  token: string;
  personnel_id?: string | null;
  personnel?: { first_name: string; last_name: string } | null;
}

interface PersonnelOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function UserManagement() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { canView, canAdd, canEdit, canDelete, loading: permLoading } = usePermissionCheck('user_management');
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
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
  
  // Personnel linking and manual credential states
  const [personnelOptions, setPersonnelOptions] = useState<PersonnelOption[]>([]);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [personnelComboOpen, setPersonnelComboOpen] = useState(false);
  const [createManually, setCreateManually] = useState(false);
  const [manualPassword, setManualPassword] = useState("");
  const [manualConfirmPassword, setManualConfirmPassword] = useState("");
  const [manualFirstName, setManualFirstName] = useState("");
  const [manualLastName, setManualLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Wait for both role and permission loading to complete
    if (roleLoading || permLoading) return;
    
    // Allow if admin OR has view permission
    const hasAccess = isAdmin || canView;
    
    if (!hasAccess) {
      navigate("/");
      toast({
        title: "Access denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
    }
  }, [isAdmin, roleLoading, permLoading, canView, navigate, toast]);

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
    fetchPersonnelOptions();
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
      // Get vendor user IDs to exclude them from user management
      const { data: vendorUsers } = await supabase
        .from("vendors")
        .select("user_id")
        .not("user_id", "is", null);

      const vendorUserIds = vendorUsers?.map((v) => v.user_id).filter(Boolean) || [];

      // Get personnel user IDs to exclude them from user management
      const { data: personnelUsers } = await supabase
        .from("personnel")
        .select("user_id")
        .not("user_id", "is", null);

      const personnelUserIds = personnelUsers?.map((p) => p.user_id).filter(Boolean) || [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, created_at")
        .order("created_at", { ascending: true });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Filter out vendor-linked and personnel-linked users from the list
      const filteredProfiles = (profiles || []).filter(
        (profile) => !vendorUserIds.includes(profile.id) && !personnelUserIds.includes(profile.id)
      );

      const usersWithRoles: UserWithRole[] = filteredProfiles.map((profile) => {
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

  const fetchPersonnelOptions = async () => {
    try {
      // Fetch personnel who are not yet linked to a user
      const { data, error } = await supabase
        .from("personnel")
        .select("id, first_name, last_name, email")
        .is("user_id", null)
        .order("first_name", { ascending: true });

      if (error) throw error;
      setPersonnelOptions(data || []);
    } catch (error) {
      console.error("Error fetching personnel options:", error);
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

  const handleDeleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "User removed",
        description: "The user has been successfully removed from the system.",
      });

      // Refresh lists
      await fetchUsers();
      await fetchPersonnelOptions();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error removing user",
        description: error.message || "Failed to remove user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingInvite(true);

    try {
      // If manual credential creation is enabled
      if (createManually) {
        if (manualPassword !== manualConfirmPassword) {
          toast({
            title: "Password mismatch",
            description: "The passwords you entered do not match.",
            variant: "destructive",
          });
          setIsSendingInvite(false);
          return;
        }

        if (manualPassword.length < 6) {
          toast({
            title: "Password too short",
            description: "Password must be at least 6 characters long.",
            variant: "destructive",
          });
          setIsSendingInvite(false);
          return;
        }

        // Call edge function to create user manually
        const { data, error } = await supabase.functions.invoke("create-user-manually", {
          body: {
            email: inviteEmail,
            password: manualPassword,
            firstName: manualFirstName,
            lastName: manualLastName,
            role: inviteRole,
            personnelId: selectedPersonnelId,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast({
          title: "User created!",
          description: `Account created for ${inviteEmail}. They can log in immediately.`,
        });

        // Reset form
        setInviteDialogOpen(false);
        setInviteEmail("");
        setInviteRole("user");
        setCreateManually(false);
        setManualPassword("");
        setManualConfirmPassword("");
        setManualFirstName("");
        setManualLastName("");
        setSelectedPersonnelId(null);
        
        // Refresh lists
        await fetchUsers();
        await fetchPersonnelOptions();
      } else {
        // Original invitation flow
        const token = crypto.randomUUID();

        // Create invitation record with personnel_id if selected
        const { data: invitationData, error: inviteError } = await supabase
          .from("invitations")
          .insert({
            email: inviteEmail,
            role: inviteRole,
            token: token,
            invited_by: (await supabase.auth.getUser()).data.user?.id,
            personnel_id: selectedPersonnelId,
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
        setSelectedPersonnelId(null);
        
        // Refresh invitations list
        await fetchInvitations();
        await fetchActivityLogs();
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: createManually ? "Error creating user" : "Error sending invitation",
        description: error.message || "Failed to complete. Please try again.",
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
        .select("id, email, role, created_at, expires_at, status, token, personnel_id, personnel:personnel_id(first_name, last_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform data to match interface
      const transformed = (data || []).map(inv => ({
        ...inv,
        personnel: inv.personnel as { first_name: string; last_name: string } | null
      }));
      
      setInvitations(transformed);
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
      description={isMobile ? undefined : "Manage users and their roles"}
    >
      <div className="space-y-6">
        {/* Stats Section */}
        <UserStats users={users} />

        <Tabs defaultValue="users" className="w-full">
          <TabsList className={cn(
            isMobile 
              ? "flex w-full overflow-x-auto gap-1 -mx-4 px-4 pb-2 scrollbar-hide justify-start bg-transparent h-auto" 
              : isAdmin ? "grid w-full max-w-3xl grid-cols-5" : "grid w-full max-w-2xl grid-cols-4"
          )}>
            <TabsTrigger value="users" className={cn(isMobile && "min-h-[44px] px-4 shrink-0")}>
              Users
            </TabsTrigger>
            <TabsTrigger value="invitations" className={cn(isMobile && "min-h-[44px] px-4 shrink-0")}>
              Invitations {invitations.length > 0 && `(${invitations.length})`}
            </TabsTrigger>
            <TabsTrigger value="activity" className={cn(isMobile && "min-h-[44px] px-4 shrink-0")}>
              Activity
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="timeclock" className={cn(isMobile && "min-h-[44px] px-4 shrink-0")}>
                {isMobile ? "Time Clock" : "Time Clock Admin"}
              </TabsTrigger>
            )}
            <TabsTrigger value="notifications" className={cn(isMobile && "min-h-[44px] px-4 shrink-0")}>
              {isMobile ? "Notifs" : "Notifications"}
            </TabsTrigger>
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
            {/* Hide invite button on mobile - shown in MobileActionBar */}
            {!isMobile && (
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Invite User
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Invite New User</DialogTitle>
                  <DialogDescription>
                    {createManually 
                      ? "Create a user account directly with credentials."
                      : "Send an invitation email to a new user with a pre-assigned role."}
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
                        <SelectItem value="accounting">Accounting</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Personnel Linking */}
                  <div>
                    <Label>Link to Personnel (Optional)</Label>
                    <Popover open={personnelComboOpen} onOpenChange={setPersonnelComboOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={personnelComboOpen}
                          className="w-full justify-between mt-1.5"
                        >
                          {selectedPersonnelId
                            ? personnelOptions.find((p) => p.id === selectedPersonnelId)
                              ? `${personnelOptions.find((p) => p.id === selectedPersonnelId)?.first_name} ${personnelOptions.find((p) => p.id === selectedPersonnelId)?.last_name}`
                              : "Select personnel..."
                            : "Select personnel..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search personnel..." />
                          <CommandList>
                            <CommandEmpty>No personnel found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value=""
                                onSelect={() => {
                                  setSelectedPersonnelId(null);
                                  setPersonnelComboOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedPersonnelId === null ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                None
                              </CommandItem>
                              {personnelOptions.map((person) => (
                                <CommandItem
                                  key={person.id}
                                  value={`${person.first_name} ${person.last_name} ${person.email}`}
                                  onSelect={() => {
                                    setSelectedPersonnelId(person.id);
                                    setPersonnelComboOpen(false);
                                    // Auto-fill email if not already set
                                    if (!inviteEmail) {
                                      setInviteEmail(person.email);
                                    }
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedPersonnelId === person.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{person.first_name} {person.last_name}</span>
                                    <span className="text-xs text-muted-foreground">{person.email}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectedPersonnelId && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Link className="h-3 w-3" />
                        Will link user account to personnel record
                      </div>
                    )}
                  </div>

                  {/* Manual Creation Toggle */}
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="create-manually" className="font-medium">
                        Create credentials manually
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Skip email invite and set password directly
                      </p>
                    </div>
                    <Switch
                      id="create-manually"
                      checked={createManually}
                      onCheckedChange={setCreateManually}
                    />
                  </div>

                  {/* Manual Credential Fields */}
                  {createManually && (
                    <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="manual-first-name">First Name</Label>
                          <Input
                            id="manual-first-name"
                            type="text"
                            value={manualFirstName}
                            onChange={(e) => setManualFirstName(e.target.value)}
                            placeholder="John"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor="manual-last-name">Last Name</Label>
                          <Input
                            id="manual-last-name"
                            type="text"
                            value={manualLastName}
                            onChange={(e) => setManualLastName(e.target.value)}
                            placeholder="Doe"
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="manual-password">Password</Label>
                        <div className="relative mt-1.5">
                          <Input
                            id="manual-password"
                            type={showPassword ? "text" : "password"}
                            value={manualPassword}
                            onChange={(e) => setManualPassword(e.target.value)}
                            placeholder="••••••••"
                            required={createManually}
                            minLength={6}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="manual-confirm-password">Confirm Password</Label>
                        <Input
                          id="manual-confirm-password"
                          type={showPassword ? "text" : "password"}
                          value={manualConfirmPassword}
                          onChange={(e) => setManualConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          required={createManually}
                          minLength={6}
                          className="mt-1.5"
                        />
                        {manualPassword && manualConfirmPassword && manualPassword !== manualConfirmPassword && (
                          <p className="text-xs text-destructive mt-1">Passwords do not match</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => {
                      setInviteDialogOpen(false);
                      setCreateManually(false);
                      setManualPassword("");
                      setManualConfirmPassword("");
                      setManualFirstName("");
                      setManualLastName("");
                      setSelectedPersonnelId(null);
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSendingInvite || (createManually && manualPassword !== manualConfirmPassword)}>
                      {isSendingInvite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {createManually ? "Create User" : "Send Invitation"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            )}
            {/* Mobile-only Dialog (outside the conditional) */}
            {isMobile && (
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Invite New User</DialogTitle>
                    <DialogDescription>
                      {createManually 
                        ? "Create a user account directly with credentials."
                        : "Send an invitation email to a new user with a pre-assigned role."}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSendInvitation} className="space-y-4">
                    <div>
                      <Label htmlFor="invite-email-mobile">Email Address</Label>
                      <div className="relative mt-1.5">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="invite-email-mobile"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="user@example.com"
                          className="pl-9 min-h-[44px]"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="invite-role-mobile">Role</Label>
                      <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as AppRole)}>
                        <SelectTrigger id="invite-role-mobile" className="mt-1.5 min-h-[44px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="accounting">Accounting</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Manual Creation Toggle */}
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="create-manually-mobile" className="font-medium">
                          Create credentials manually
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Skip email invite and set password directly
                        </p>
                      </div>
                      <Switch
                        id="create-manually-mobile"
                        checked={createManually}
                        onCheckedChange={setCreateManually}
                      />
                    </div>

                    {/* Manual Credential Fields */}
                    {createManually && (
                      <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <Label htmlFor="manual-first-name-mobile">First Name</Label>
                            <Input
                              id="manual-first-name-mobile"
                              type="text"
                              value={manualFirstName}
                              onChange={(e) => setManualFirstName(e.target.value)}
                              placeholder="John"
                              className="mt-1.5 min-h-[44px]"
                            />
                          </div>
                          <div>
                            <Label htmlFor="manual-last-name-mobile">Last Name</Label>
                            <Input
                              id="manual-last-name-mobile"
                              type="text"
                              value={manualLastName}
                              onChange={(e) => setManualLastName(e.target.value)}
                              placeholder="Doe"
                              className="mt-1.5 min-h-[44px]"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="manual-password-mobile">Password</Label>
                          <div className="relative mt-1.5">
                            <Input
                              id="manual-password-mobile"
                              type={showPassword ? "text" : "password"}
                              value={manualPassword}
                              onChange={(e) => setManualPassword(e.target.value)}
                              placeholder="••••••••"
                              required={createManually}
                              minLength={6}
                              className="min-h-[44px]"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="manual-confirm-password-mobile">Confirm Password</Label>
                          <Input
                            id="manual-confirm-password-mobile"
                            type={showPassword ? "text" : "password"}
                            value={manualConfirmPassword}
                            onChange={(e) => setManualConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required={createManually}
                            minLength={6}
                            className="mt-1.5 min-h-[44px]"
                          />
                          {manualPassword && manualConfirmPassword && manualPassword !== manualConfirmPassword && (
                            <p className="text-xs text-destructive mt-1">Passwords do not match</p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 pt-4">
                      <Button type="submit" disabled={isSendingInvite || (createManually && manualPassword !== manualConfirmPassword)} className="min-h-[44px]">
                        {isSendingInvite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {createManually ? "Create User" : "Send Invitation"}
                      </Button>
                      <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => {
                        setInviteDialogOpen(false);
                        setCreateManually(false);
                        setManualPassword("");
                        setManualConfirmPassword("");
                        setManualFirstName("");
                        setManualLastName("");
                        setSelectedPersonnelId(null);
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
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
                    onDelete={handleDeleteUser}
                    isUpdating={updatingUserId === user.id}
                    isDeleting={deletingUserId === user.id}
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
                        disabled={updatingUserId === user.id || deletingUserId === user.id}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Change role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="accounting">Accounting</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                      {updatingUserId === user.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                            disabled={deletingUserId === user.id}
                          >
                            {deletingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove <strong>{user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email}</strong> ({user.email})? 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteUser(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove User
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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

          {isAdmin && (
            <TabsContent value="timeclock" className="mt-6">
              <TimeClockAdminTab />
            </TabsContent>
          )}

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

      {/* Mobile Action Bar */}
      <MobileActionBar
        primaryActions={[
          {
            label: "Invite User",
            icon: <Plus className="h-4 w-4" />,
            onClick: () => setInviteDialogOpen(true),
          },
        ]}
      />
    </PageLayout>
    </>
  );
}
