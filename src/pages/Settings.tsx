import { useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Cloud, ChevronRight, Clock, Tag } from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissionCheck } from "@/hooks/usePermissionCheck";
import { Badge } from "@/components/ui/badge";
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";
import { useQuickBooksConfig } from "@/integrations/supabase/hooks/useQuickBooks";
import { useUserDisplayPreferences } from "@/hooks/useUserDisplayPreferences";
import { useSessionAccess } from "@/hooks/useSessionAccess";
import { CheckForUpdatesButton } from "@/components/electron/UpdateNotification";

export default function Settings() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { role, loading: roleLoading } = useUserRole();
  const { canView: hasUserMgmtPermission } =
    usePermissionCheck("user_management");
  const { data: qbConfig } = useQuickBooksConfig();
  const { hasAccess: hasSessionAccess } = useSessionAccess();
  const {
    showSessionEarnings,
    updateShowSessionEarnings,
    isUpdating: isUpdatingPrefs,
  } = useUserDisplayPreferences();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setIsChangingPassword(false);

    if (error) {
      toast({
        title: "Error changing password",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password updated",
        description: "Your password has been successfully changed.",
      });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <>
      <SEO
        title="Settings"
        description="Configure your account and application preferences"
        keywords="settings, account settings, preferences, profile, password"
      />
      <PageLayout
        title="Settings"
        description="Manage your account settings and preferences"
      >
        <div className="max-w-4xl space-y-6">
          {/* Integrations Section */}
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>Connect external services</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/settings/quickbooks">
                <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        qbConfig?.is_connected ? "bg-green-500/10" : "bg-muted"
                      }`}
                    >
                      <Cloud
                        className={`h-5 w-5 ${
                          qbConfig?.is_connected
                            ? "text-green-500"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="font-medium">QuickBooks Online</p>
                      <p className="text-sm text-muted-foreground">
                        {qbConfig?.is_connected
                          ? `Connected to ${qbConfig.company_name}`
                          : "Sync products, customers, and invoices"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={qbConfig?.is_connected ? "default" : "secondary"}
                    >
                      {qbConfig?.is_connected ? "Connected" : "Not Connected"}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>

              {/* Expense Categories */}
              <Link to="/settings/expense-categories">
                <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer mt-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Tag className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Expense Categories</p>
                      <p className="text-sm text-muted-foreground">
                        Manage expense categories and QuickBooks mappings
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>

              {/* Session History - for users with user management access */}
              {(role === "admin" ||
                role === "manager" ||
                hasUserMgmtPermission) && (
                <Link to="/session-history">
                  <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer mt-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Session History</p>
                        <p className="text-sm text-muted-foreground">
                          View your work sessions and activity logs
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Company Settings Section (Admin Only) */}
          {role === "admin" && <CompanySettingsForm />}

          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled className="mt-1.5" />
              </div>
              <div>
                <Label>Role</Label>
                <div className="mt-1.5">
                  {roleLoading ? (
                    <Badge variant="outline">Loading...</Badge>
                  ) : (
                    <Badge variant={role === "admin" ? "default" : "secondary"}>
                      {role
                        ? role.charAt(0).toUpperCase() + role.slice(1)
                        : "No role assigned"}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Password Section */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="mt-1.5"
                    required
                  />
                </div>
                <Button type="submit" disabled={isChangingPassword}>
                  {isChangingPassword && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Preferences Section */}
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Customize your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Toggle dark mode on or off
                  </p>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) =>
                    setTheme(checked ? "dark" : "light")
                  }
                />
              </div>

              {hasSessionAccess && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Session Earnings</Label>
                    <p className="text-sm text-muted-foreground">
                      Display earnings in the session timer
                    </p>
                  </div>
                  <Switch
                    checked={showSessionEarnings}
                    onCheckedChange={updateShowSessionEarnings}
                    disabled={isUpdatingPrefs}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Application Section - Only show in Electron */}
          {typeof window !== "undefined" &&
            (window as any).electronAPI?.isElectron && (
              <Card>
                <CardHeader>
                  <CardTitle>Application</CardTitle>
                  <CardDescription>Desktop app settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Software Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Check for new versions of the app
                      </p>
                    </div>
                    <CheckForUpdatesButton />
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Account Section */}
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Manage your account</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={signOut}>
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    </>
  );
}
