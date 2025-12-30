import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, ExternalLink, Lock, Shield, Bell, MapPin, MessageSquare } from "lucide-react";

export interface FormSettings {
  redirectUrl?: string;
  allowMultipleSubmissions?: boolean;
  isPublic?: boolean;
  enableCaptcha?: boolean;
  rateLimitPerHour?: number;
  showInlineErrors?: boolean;
  showErrorSummary?: boolean;
  requireProfilePhoto?: boolean;
  requireLocation?: boolean;
  requireSmsConsent?: boolean;
  smsConsentTextVersion?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
}

interface FormSettingsPanelProps {
  successMessage: string;
  onSuccessMessageChange: (value: string) => void;
  settings: FormSettings;
  onSettingsChange: (settings: FormSettings) => void;
}

export function FormSettingsPanel({
  successMessage,
  onSuccessMessageChange,
  settings,
  onSettingsChange,
}: FormSettingsPanelProps) {
  const updateSetting = <K extends keyof FormSettings>(key: K, value: FormSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6">
      {/* Submission Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Submission Settings
          </CardTitle>
          <CardDescription>
            Configure what happens after a form is submitted
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Success Message</Label>
            <Textarea
              value={successMessage}
              onChange={(e) => onSuccessMessageChange(e.target.value)}
              placeholder="Thank you for your submission!"
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Shown to users after successful submission
            </p>
          </div>

          <div>
            <Label>Redirect URL (Optional)</Label>
            <div className="relative">
              <Input
                value={settings.redirectUrl || ""}
                onChange={(e) => updateSetting("redirectUrl", e.target.value)}
                placeholder="https://example.com/thank-you"
                className="pr-10"
              />
              <ExternalLink className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              If set, users will be redirected here instead of seeing the success message
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow Multiple Submissions</Label>
              <p className="text-xs text-muted-foreground">
                Let users submit multiple times from the same email
              </p>
            </div>
            <Switch
              checked={settings.allowMultipleSubmissions !== false}
              onCheckedChange={(checked) => updateSetting("allowMultipleSubmissions", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Access Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Access Control
          </CardTitle>
          <CardDescription>
            Control who can access and submit this form
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Public Form</Label>
              <p className="text-xs text-muted-foreground">
                Allow anyone with the link to submit
              </p>
            </div>
            <Switch
              checked={settings.isPublic !== false}
              onCheckedChange={(checked) => updateSetting("isPublic", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable CAPTCHA</Label>
              <p className="text-xs text-muted-foreground">
                Add bot protection (coming soon)
              </p>
            </div>
            <Switch
              checked={settings.enableCaptcha || false}
              onCheckedChange={(checked) => updateSetting("enableCaptcha", checked)}
              disabled
            />
          </div>

          <div>
            <Label>Rate Limit (submissions per hour)</Label>
            <Input
              type="number"
              value={settings.rateLimitPerHour || ""}
              onChange={(e) => updateSetting("rateLimitPerHour", parseInt(e.target.value) || undefined)}
              placeholder="No limit"
              min={1}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Limit submissions to prevent spam (optional)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SMS Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Notifications
          </CardTitle>
          <CardDescription>
            Configure TCPA-compliant SMS consent requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require SMS Consent</Label>
              <p className="text-xs text-muted-foreground">
                Applicants must consent to SMS notifications to submit
              </p>
            </div>
            <Switch
              checked={settings.requireSmsConsent || false}
              onCheckedChange={(checked) => updateSetting("requireSmsConsent", checked)}
            />
          </div>

          {settings.requireSmsConsent && (
            <>
              <div className="p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4 text-primary" />
                  TCPA-Compliant Consent Language (v1.0)
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  "I agree to receive SMS notifications about my contractor status, 
                  assignment updates, and payment information. Message frequency: up to 
                  3 messages per week. Msg & data rates may apply."
                </p>
              </div>

              <div>
                <Label>Privacy Policy URL</Label>
                <Input
                  value={settings.privacyPolicyUrl || ""}
                  onChange={(e) => updateSetting("privacyPolicyUrl", e.target.value)}
                  placeholder="https://yoursite.com/privacy"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Link to your privacy policy (displayed with consent)
                </p>
              </div>

              <div>
                <Label>Terms of Service URL</Label>
                <Input
                  value={settings.termsOfServiceUrl || ""}
                  onChange={(e) => updateSetting("termsOfServiceUrl", e.target.value)}
                  placeholder="https://yoursite.com/terms"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Link to your terms of service (displayed with consent)
                </p>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Compliance:</strong> IP address, timestamp, and consent version 
                  are automatically recorded for TCPA compliance.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Location & Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location & Tracking
          </CardTitle>
          <CardDescription>
            Capture geolocation and timestamp data with submissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require Location on Submit</Label>
              <p className="text-xs text-muted-foreground">
                Block submission if location access is denied
              </p>
            </div>
            <Switch
              checked={settings.requireLocation || false}
              onCheckedChange={(checked) => updateSetting("requireLocation", checked)}
            />
          </div>

          <div className="p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4 text-primary" />
              Automatic Tracking
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All submissions automatically capture: server timestamp, client timestamp, 
              GPS coordinates (when permitted), and user agent. Location falls back gracefully 
              if permission is denied.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Error Display
          </CardTitle>
          <CardDescription>
            Configure how validation errors are shown
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Inline Field Errors</Label>
              <p className="text-xs text-muted-foreground">
                Show errors next to each invalid field
              </p>
            </div>
            <Switch
              checked={settings.showInlineErrors !== false}
              onCheckedChange={(checked) => updateSetting("showInlineErrors", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Error Summary at Top</Label>
              <p className="text-xs text-muted-foreground">
                Show a summary of all errors at the top of the form
              </p>
            </div>
            <Switch
              checked={settings.showErrorSummary || false}
              onCheckedChange={(checked) => updateSetting("showErrorSummary", checked)}
            />
          </div>

          <div className="p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4 text-primary" />
              Never Fail Silently
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Form submissions will always show clear feedback - success or error
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
