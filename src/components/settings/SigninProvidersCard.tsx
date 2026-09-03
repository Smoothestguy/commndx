import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, KeyRound, Info } from "lucide-react";
import { toast } from "sonner";

interface Settings {
  google_client_id: string | null;
  facebook_app_id: string | null;
  apply_google_enabled: boolean;
  apply_facebook_enabled: boolean;
  staff_google_enabled: boolean;
  staff_facebook_enabled: boolean;
}

const DEFAULTS: Settings = {
  google_client_id: "",
  facebook_app_id: "",
  apply_google_enabled: false,
  apply_facebook_enabled: false,
  staff_google_enabled: false,
  staff_facebook_enabled: false,
};

export function SigninProvidersCard() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Settings>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["signin-provider-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signin_provider_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        google_client_id: data.google_client_id ?? "",
        facebook_app_id: data.facebook_app_id ?? "",
        apply_google_enabled: data.apply_google_enabled,
        apply_facebook_enabled: data.apply_facebook_enabled,
        staff_google_enabled: data.staff_google_enabled,
        staff_facebook_enabled: data.staff_facebook_enabled,
      });
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("signin_provider_settings")
        .upsert({
          id: 1,
          google_client_id: form.google_client_id?.trim() || null,
          facebook_app_id: form.facebook_app_id?.trim() || null,
          apply_google_enabled: form.apply_google_enabled,
          apply_facebook_enabled: form.apply_facebook_enabled,
          staff_google_enabled: form.staff_google_enabled,
          staff_facebook_enabled: form.staff_facebook_enabled,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["signin-provider-settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-signin-providers"] });
      toast.success("Sign-in provider settings saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof Settings) => (checked: boolean) =>
    setForm((f) => ({ ...f, [key]: checked }));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Sign-in providers</CardTitle>
            <CardDescription>
              Google and Facebook for the public application form and staff login
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="google-client-id">Google Client ID</Label>
                <Input
                  id="google-client-id"
                  value={form.google_client_id ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, google_client_id: e.target.value }))}
                  placeholder="1234567890-abc.apps.googleusercontent.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook-app-id">Facebook App ID</Label>
                <Input
                  id="facebook-app-id"
                  value={form.facebook_app_id ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, facebook_app_id: e.target.value }))}
                  placeholder="1234567890123456"
                />
              </div>
            </div>

            <div className="space-y-3">
              {[
                { key: "apply_google_enabled", label: "Apply with Google", hint: "Prefills the public application form (no account created)" },
                { key: "apply_facebook_enabled", label: "Apply with Facebook", hint: "Prefills the public application form (no account created)" },
                { key: "staff_google_enabled", label: "Staff login with Google", hint: "Command X sign-in for existing/invited accounts" },
                { key: "staff_facebook_enabled", label: "Staff login with Facebook", hint: "Command X sign-in for existing/invited accounts" },
              ].map(({ key, label, hint }) => (
                <div key={key} className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <Switch
                    checked={form[key as keyof Settings] as boolean}
                    onCheckedChange={toggle(key as keyof Settings)}
                  />
                </div>
              ))}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Setup instructions</AlertTitle>
              <AlertDescription className="space-y-2 text-xs">
                <p>Register these exact values with the provider:</p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>
                    Authorized JavaScript origins: <code>https://fairfieldrg.com</code> and{" "}
                    <code>https://commndx.lovable.app</code>
                  </li>
                  <li>
                    OAuth redirect URI:{" "}
                    <code>https://xfjjvznxkcckuwxmcsdc.supabase.co/auth/v1/callback</code>
                  </li>
                </ul>
                <p>
                  Client IDs above are public identifiers — never paste a client secret here. The
                  staff-login toggles also require enabling the provider (with its client secret) in
                  the backend Auth settings, and “allow manual/automatic identity linking” must be on
                  if you want provider sign-in to attach to an existing email account.
                </p>
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
