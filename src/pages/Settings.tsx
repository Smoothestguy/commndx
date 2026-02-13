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
import { 
  Loader2, 
  Cloud, 
  ChevronRight, 
  Clock, 
  Tag, 
  User, 
  Shield, 
  Plug, 
  Settings2, 
  LogOut,
  Monitor
} from "lucide-react";
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
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";
import AppWalkthroughDownload from "@/components/AppWalkthroughDownload";

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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast({
        title: "Current password required",
        description: "Please enter your current password.",
        variant: "destructive",
      });
      return;
    }

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

    // Step 1: Verify current password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: currentPassword,
    });

    if (verifyError) {
      setIsChangingPassword(false);
      toast({
        title: "Invalid current password",
        description: "Please enter your correct current password.",
        variant: "destructive",
      });
      return;
    }

    // Step 2: Update to new password
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
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const isElectron = typeof window !== "undefined" && (window as any).electronAPI?.isElectron;

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
        <div className="space-y-6">
          {/* Two-column grid for main settings */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Column 1 */}
            <div className="space-y-6">
              {/* Profile Card */}
              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Profile</CardTitle>
                      <CardDescription>Your account information</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Email</Label>
                    <Input value={user?.email || ""} disabled className="mt-1.5 bg-muted/50" />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Role</Label>
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

              {/* Security Card */}
              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                      <Shield className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Security</CardTitle>
                      <CardDescription>Update your password</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-5">
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="mt-1.5"
                        required
                      />
                    </div>
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
                    <Button type="submit" disabled={isChangingPassword} size="sm">
                      {isChangingPassword && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Update Password
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Column 2 */}
            <div className="space-y-6">
              {/* Integrations Card */}
              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Plug className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Integrations</CardTitle>
                      <CardDescription>Connect external services</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-3">
                  <Link to="/settings/quickbooks">
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            qbConfig?.is_connected ? "bg-green-500/10" : "bg-muted"
                          }`}
                        >
                          <Cloud
                            className={`h-4 w-4 ${
                              qbConfig?.is_connected
                                ? "text-green-500"
                                : "text-muted-foreground"
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-sm">QuickBooks Online</p>
                          <p className="text-xs text-muted-foreground">
                            {qbConfig?.is_connected
                              ? `Connected to ${qbConfig.company_name}`
                              : "Sync products, customers, and invoices"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={qbConfig?.is_connected ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {qbConfig?.is_connected ? "Connected" : "Not Connected"}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>

                  <Link to="/settings/expense-categories">
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Tag className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Expense Categories</p>
                          <p className="text-xs text-muted-foreground">
                            Manage categories and mappings
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>

                  {(role === "admin" ||
                    role === "manager" ||
                    hasUserMgmtPermission) && (
                    <Link to="/session-history">
                      <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Clock className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Session History</p>
                            <p className="text-xs text-muted-foreground">
                              View work sessions and activity
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  )}
                </CardContent>
              </Card>

              {/* Preferences Card */}
              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                      <Settings2 className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Preferences</CardTitle>
                      <CardDescription>Customize your experience</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Dark Mode</Label>
                      <p className="text-xs text-muted-foreground">
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
                        <Label className="text-sm">Show Session Earnings</Label>
                        <p className="text-xs text-muted-foreground">
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
              {isElectron && (
                <Card className="overflow-hidden">
                  <CardHeader className="border-b bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Monitor className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Application</CardTitle>
                        <CardDescription>Desktop app settings</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Software Updates</Label>
                        <p className="text-xs text-muted-foreground">
                          Check for new versions
                        </p>
                      </div>
                      <CheckForUpdatesButton />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Company Settings - Full Width (Admin Only) */}
          {role === "admin" && <CompanySettingsForm />}

          {/* Documentation */}
          <div className="border-t pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-medium text-sm">Application Documentation</p>
                <p className="text-xs text-muted-foreground">
                  Download a complete walkthrough of all features and modules
                </p>
              </div>
              <AppWalkthroughDownload />
            </div>
          </div>

          {/* Account Actions Footer */}
          <div className="border-t pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-medium text-sm">Sign out of your account</p>
                <p className="text-xs text-muted-foreground">
                  You'll need to sign in again to access the app
                </p>
              </div>
              <Button variant="outline" onClick={signOut} size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>

          {/* Danger Zone - Account Deletion */}
          <DeleteAccountSection />
        </div>
      </PageLayout>
    </>
  );
}
