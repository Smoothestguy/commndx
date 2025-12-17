import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bell, Volume2, Monitor } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface NotificationPreferencesProps {
  userId: string;
  onSave?: (preferences: Preferences) => void;
}

interface Preferences {
  event_accepted: boolean;
  event_expired: boolean;
  event_cancelled: boolean;
  event_reminder_sent: boolean;
  event_sent: boolean;
  event_resent: boolean;
  po_submitted_for_approval: boolean;
  po_approved: boolean;
  po_rejected: boolean;
  po_sent: boolean;
  po_status_changed: boolean;
  co_submitted_for_approval: boolean;
  personnel_registration_pending: boolean;
  notification_toast: boolean;
  notification_sound: boolean;
  notification_browser: boolean;
}

export function NotificationPreferences({ userId, onSave }: NotificationPreferencesProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({
    event_accepted: true,
    event_expired: true,
    event_cancelled: true,
    event_reminder_sent: true,
    event_sent: false,
    event_resent: false,
    po_submitted_for_approval: true,
    po_approved: true,
    po_rejected: true,
    po_sent: true,
    po_status_changed: true,
    co_submitted_for_approval: true,
    personnel_registration_pending: true,
    notification_toast: true,
    notification_sound: false,
    notification_browser: false,
  });

  useEffect(() => {
    fetchPreferences();
  }, [userId]);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          event_sent: data.event_sent ?? false,
          event_resent: data.event_resent ?? false,
          event_accepted: data.event_accepted ?? true,
          event_cancelled: data.event_cancelled ?? true,
          event_expired: data.event_expired ?? true,
          event_reminder_sent: data.event_reminder_sent ?? true,
          po_submitted_for_approval: data.po_submitted_for_approval ?? true,
          po_approved: data.po_approved ?? true,
          po_rejected: data.po_rejected ?? true,
          po_sent: data.po_sent ?? true,
          po_status_changed: data.po_status_changed ?? true,
          co_submitted_for_approval: (data as any).co_submitted_for_approval ?? true,
          personnel_registration_pending: (data as any).personnel_registration_pending ?? true,
          notification_toast: data.notification_toast ?? true,
          notification_sound: data.notification_sound ?? false,
          notification_browser: data.notification_browser ?? false,
        });
      } else {
        // No preferences exist, create default ones
        const defaultPreferences = {
          user_id: userId,
          event_sent: false,
          event_resent: false,
          event_accepted: true,
          event_cancelled: true,
          event_expired: true,
          event_reminder_sent: true,
          po_submitted_for_approval: true,
          po_approved: true,
          po_rejected: true,
          po_sent: true,
          po_status_changed: true,
          co_submitted_for_approval: true,
          personnel_registration_pending: true,
          notification_toast: true,
          notification_sound: false,
          notification_browser: false,
        };

        const { error: insertError } = await supabase
          .from("notification_preferences")
          .insert(defaultPreferences);

        if (insertError) throw insertError;

        setPreferences({
          event_sent: false,
          event_resent: false,
          event_accepted: true,
          event_cancelled: true,
          event_expired: true,
          event_reminder_sent: true,
          po_submitted_for_approval: true,
          po_approved: true,
          po_rejected: true,
          po_sent: true,
          po_status_changed: true,
          co_submitted_for_approval: true,
          personnel_registration_pending: true,
          notification_toast: true,
          notification_sound: false,
          notification_browser: false,
        });
      }
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existingPrefs } = await supabase
        .from("notification_preferences")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingPrefs) {
        const { error } = await supabase
          .from("notification_preferences")
          .update(preferences)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_preferences")
          .insert({ ...preferences, user_id: userId });

        if (error) throw error;
      }

      toast({
        title: "Preferences saved",
        description: "Your notification preferences have been updated.",
      });
      
      onSave?.(preferences);
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const requestBrowserPermission = async () => {
    if (!("Notification" in window)) {
      toast({
        title: "Not supported",
        description: "Your browser doesn't support notifications",
        variant: "destructive",
      });
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setPreferences({ ...preferences, notification_browser: true });
      toast({
        title: "Notifications enabled",
        description: "You'll now receive browser notifications",
      });
    } else {
      toast({
        title: "Permission denied",
        description: "Please enable notifications in your browser settings",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Customize which invitation events trigger notifications and how you want to be notified
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Event Types */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">Notification Events</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose which invitation events you want to be notified about
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="event-accepted" className="flex-1 cursor-pointer">
                <span className="font-medium">Invitation Accepted</span>
                <p className="text-sm text-muted-foreground">When a user accepts an invitation</p>
              </Label>
              <Switch
                id="event-accepted"
                checked={preferences.event_accepted}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, event_accepted: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="event-expired" className="flex-1 cursor-pointer">
                <span className="font-medium">Invitation Expired</span>
                <p className="text-sm text-muted-foreground">When an invitation expires</p>
              </Label>
              <Switch
                id="event-expired"
                checked={preferences.event_expired}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, event_expired: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="event-cancelled" className="flex-1 cursor-pointer">
                <span className="font-medium">Invitation Cancelled</span>
                <p className="text-sm text-muted-foreground">When an invitation is cancelled</p>
              </Label>
              <Switch
                id="event-cancelled"
                checked={preferences.event_cancelled}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, event_cancelled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="event-reminder" className="flex-1 cursor-pointer">
                <span className="font-medium">Expiry Reminder</span>
                <p className="text-sm text-muted-foreground">When an expiry reminder is sent</p>
              </Label>
              <Switch
                id="event-reminder"
                checked={preferences.event_reminder_sent}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, event_reminder_sent: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="event-sent" className="flex-1 cursor-pointer">
                <span className="font-medium">Invitation Sent</span>
                <p className="text-sm text-muted-foreground">When a new invitation is sent</p>
              </Label>
              <Switch
                id="event-sent"
                checked={preferences.event_sent}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, event_sent: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="event-resent" className="flex-1 cursor-pointer">
                <span className="font-medium">Invitation Resent</span>
                <p className="text-sm text-muted-foreground">When an invitation is resent</p>
              </Label>
              <Switch
                id="event-resent"
                checked={preferences.event_resent}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, event_resent: checked })
                }
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Purchase Order Events */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">Purchase Order Events</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose which purchase order events you want to be notified about
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="po-submitted" className="flex-1 cursor-pointer">
                <span className="font-medium">PO Submitted for Approval</span>
                <p className="text-sm text-muted-foreground">When a purchase order is submitted for approval</p>
              </Label>
              <Switch
                id="po-submitted"
                checked={preferences.po_submitted_for_approval}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, po_submitted_for_approval: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="po-approved" className="flex-1 cursor-pointer">
                <span className="font-medium">PO Approved</span>
                <p className="text-sm text-muted-foreground">When a purchase order is approved</p>
              </Label>
              <Switch
                id="po-approved"
                checked={preferences.po_approved}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, po_approved: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="po-rejected" className="flex-1 cursor-pointer">
                <span className="font-medium">PO Rejected</span>
                <p className="text-sm text-muted-foreground">When a purchase order is rejected</p>
              </Label>
              <Switch
                id="po-rejected"
                checked={preferences.po_rejected}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, po_rejected: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="po-sent" className="flex-1 cursor-pointer">
                <span className="font-medium">PO Sent to Vendor</span>
                <p className="text-sm text-muted-foreground">When a purchase order is sent to a vendor</p>
              </Label>
              <Switch
                id="po-sent"
                checked={preferences.po_sent}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, po_sent: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="po-status-changed" className="flex-1 cursor-pointer">
                <span className="font-medium">PO Status Changed</span>
                <p className="text-sm text-muted-foreground">When a purchase order status changes</p>
              </Label>
              <Switch
                id="po-status-changed"
                checked={preferences.po_status_changed}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, po_status_changed: checked })
                }
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Change Order & Personnel Events */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">Change Orders & Personnel</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose which approval events you want to be notified about
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="co-submitted" className="flex-1 cursor-pointer">
                <span className="font-medium">Change Order Submitted</span>
                <p className="text-sm text-muted-foreground">When a change order requires approval</p>
              </Label>
              <Switch
                id="co-submitted"
                checked={preferences.co_submitted_for_approval}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, co_submitted_for_approval: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="personnel-registration" className="flex-1 cursor-pointer">
                <span className="font-medium">Personnel Registration Pending</span>
                <p className="text-sm text-muted-foreground">When a new personnel registration needs review</p>
              </Label>
              <Switch
                id="personnel-registration"
                checked={preferences.personnel_registration_pending}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, personnel_registration_pending: checked })
                }
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Notification Types */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">Notification Methods</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose how you want to receive notifications
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="notification-toast" className="flex items-center gap-2 flex-1 cursor-pointer">
                <Monitor className="h-4 w-4" />
                <div>
                  <span className="font-medium">Toast Notifications</span>
                  <p className="text-sm text-muted-foreground">Show notifications in the app</p>
                </div>
              </Label>
              <Switch
                id="notification-toast"
                checked={preferences.notification_toast}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, notification_toast: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="notification-sound" className="flex items-center gap-2 flex-1 cursor-pointer">
                <Volume2 className="h-4 w-4" />
                <div>
                  <span className="font-medium">Sound Alerts</span>
                  <p className="text-sm text-muted-foreground">Play a sound for notifications</p>
                </div>
              </Label>
              <Switch
                id="notification-sound"
                checked={preferences.notification_sound}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, notification_sound: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="notification-browser" className="flex items-center gap-2 flex-1 cursor-pointer">
                <Bell className="h-4 w-4" />
                <div>
                  <span className="font-medium">Browser Notifications</span>
                  <p className="text-sm text-muted-foreground">Show system notifications</p>
                </div>
              </Label>
              <div className="flex items-center gap-2">
                {!preferences.notification_browser && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={requestBrowserPermission}
                  >
                    Enable
                  </Button>
                )}
                <Switch
                  id="notification-browser"
                  checked={preferences.notification_browser}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, notification_browser: checked })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
