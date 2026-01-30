import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelNotificationPreferences, useUpdateNotificationPreferences } from "@/integrations/supabase/hooks/usePortal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Bell, Mail, Smartphone, Briefcase, DollarSign, UserPlus } from "lucide-react";
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";

export default function PortalSettings() {
  const { data: personnel } = useCurrentPersonnel();
  const { data: preferences, isLoading } = usePersonnelNotificationPreferences(personnel?.id);
  const updatePreferences = useUpdateNotificationPreferences();

  const handleToggle = (key: string, value: boolean) => {
    if (!personnel?.id) return;
    updatePreferences.mutate({
      personnelId: personnel.id,
      preferences: { [key]: value },
    });
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </PortalLayout>
    );
  }

  // Default values if no preferences exist yet
  const currentPreferences = {
    email_notifications: preferences?.email_notifications ?? true,
    sms_notifications: preferences?.sms_notifications ?? false,
    job_alerts: preferences?.job_alerts ?? true,
    pay_notifications: preferences?.pay_notifications ?? true,
    assignment_notifications: preferences?.assignment_notifications ?? true,
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your notification preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Channels
            </CardTitle>
            <CardDescription>
              Choose how you want to receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="email_notifications" className="text-base">
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
              </div>
              <Switch
                id="email_notifications"
                checked={currentPreferences.email_notifications}
                onCheckedChange={(checked) => handleToggle("email_notifications", checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="sms_notifications" className="text-base">
                    SMS Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive text message alerts
                  </p>
                </div>
              </div>
              <Switch
                id="sms_notifications"
                checked={currentPreferences.sms_notifications}
                onCheckedChange={(checked) => handleToggle("sms_notifications", checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Notification Types
            </CardTitle>
            <CardDescription>
              Select which types of notifications you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="job_alerts" className="text-base">
                    Job Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    New job opportunities and assignments
                  </p>
                </div>
              </div>
              <Switch
                id="job_alerts"
                checked={currentPreferences.job_alerts}
                onCheckedChange={(checked) => handleToggle("job_alerts", checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="pay_notifications" className="text-base">
                    Pay Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Updates about pay and reimbursements
                  </p>
                </div>
              </div>
              <Switch
                id="pay_notifications"
                checked={currentPreferences.pay_notifications}
                onCheckedChange={(checked) => handleToggle("pay_notifications", checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserPlus className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="assignment_notifications" className="text-base">
                    Assignment Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Project assignment updates
                  </p>
                </div>
              </div>
              <Switch
                id="assignment_notifications"
                checked={currentPreferences.assignment_notifications}
                onCheckedChange={(checked) => handleToggle("assignment_notifications", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Profile Info Card */}
        {personnel && (
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Your personnel details (contact admin to make changes)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{personnel.first_name} {personnel.last_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Personnel Number</p>
                  <p className="font-medium">{personnel.personnel_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{personnel.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{personnel.phone || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hourly Rate</p>
                  <p className="font-medium">${personnel.hourly_rate?.toFixed(2) || "0.00"}/hr</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Danger Zone - Account Deletion */}
        <DeleteAccountSection />
      </div>
    </PortalLayout>
  );
}
