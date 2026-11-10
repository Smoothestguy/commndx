import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GenderRadio } from "./GenderRadio";
import { ProfilePhotoCapture } from "./ProfilePhotoCapture";
import { toast } from "sonner";

type Table = "applicants" | "personnel";
const MANAGER_VERSION = "manager-recorded";

/** Manager view/editor for photo, gender and intake consent proof. */
export function IntakeProfileCard({ table, id, canEdit }: { table: Table; id: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const key = ["intake-profile", table, id];
  const { data } = useQuery({
    queryKey: key,
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase.from(table) as any)
        .select("photo_url, gender, sms_consent_at, sms_consent_version, photo_consent_at, photo_consent_version, background_consent_at, background_consent_version")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Record<string, any> | null;
    },
  });
  const [saving, setSaving] = useState(false);

  const save = async (patch: Record<string, any>) => {
    setSaving(true);
    const { error } = await (supabase.from(table) as any).update(patch).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: [table === "personnel" ? "personnel" : "master-applicants"] });
    toast.success("Saved");
  };

  if (!data) return null;
  const consent = (label: string, at: string | null, version: string | null, field: "sms" | "photo") => (
    <div className="flex items-center justify-between gap-2 text-sm" data-testid={`consent-${field}`}>
      <span className="flex items-center gap-2">
        {at ? <ShieldCheck className="h-4 w-4 text-primary" /> : <ShieldAlert className="h-4 w-4 text-muted-foreground" />}
        {label}
      </span>
      {at ? (
        <Badge variant="outline" className="font-normal">{format(new Date(at), "MM/dd/yyyy HH:mm")} · {version}</Badge>
      ) : canEdit ? (
        <Button size="sm" variant="outline" disabled={saving}
          onClick={() => save({ [`${field}_consent_at`]: new Date().toISOString(), [`${field}_consent_version`]: MANAGER_VERSION })}>
          Record consent
        </Button>
      ) : <span className="text-muted-foreground">Not recorded</span>}
    </div>
  );

  return (
    <Card data-testid="intake-profile-card">
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">Photo, gender & consents {saving && <Loader2 className="h-4 w-4 animate-spin" />}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {consent("Text message consent", data.sms_consent_at, data.sms_consent_version, "sms")}
        {consent("Photo / biometric consent", data.photo_consent_at, data.photo_consent_version, "photo")}
        {data.background_consent_at && (
          <div className="text-sm text-muted-foreground">Background check consent: {format(new Date(data.background_consent_at), "MM/dd/yyyy HH:mm")} · {data.background_consent_version}</div>
        )}
        {canEdit ? (
          <>
            <GenderRadio lang="en" value={data.gender} required={false} onChange={(g) => save({ gender: g })} />
            <ProfilePhotoCapture lang="en" value={data.photo_url} consented={!!data.photo_consent_at}
              onChange={(u) => u && save({ photo_url: u })} onError={(m) => toast.error(m)} />
          </>
        ) : (
          <div className="text-sm">Gender: {data.gender === "male" ? "Male" : data.gender === "female" ? "Female" : "—"}</div>
        )}
      </CardContent>
    </Card>
  );
}
