import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  useMessageTemplates,
  useUpsertMessageTemplate,
} from "@/integrations/supabase/hooks/useMessageTemplates";

const CATEGORY = "workforce_invite";

/** Defaults used by the Workforce "Invite to posting" dialog. */
export function InvitationDefaultsCard() {
  const { data: templates = [], isLoading } = useMessageTemplates(true);
  const upsert = useUpsertMessageTemplate();

  const rows = useMemo(
    () => templates.filter((t) => t.category === CATEGORY),
    [templates]
  );
  const byName = useMemo(() => new Map(rows.map((t) => [t.name, t])), [rows]);

  const [smsEn, setSmsEn] = useState("");
  const [smsEs, setSmsEs] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sender, setSender] = useState("");
  const [consentOnly, setConsentOnly] = useState(true);

  useEffect(() => {
    if (!rows.length) return;
    setSmsEn(byName.get("sms")?.content_en ?? "");
    setSmsEs(byName.get("sms")?.content_es ?? "");
    setSubject(byName.get("email_subject")?.content_en ?? "");
    setBody(byName.get("email_body")?.content_en ?? "");
    setSender(byName.get("sender_name")?.content_en ?? "");
    setConsentOnly((byName.get("sms_consent_only")?.content_en ?? "true") !== "false");
  }, [rows, byName]);

  const save = async () => {
    const put = (name: string, en: string, es?: string | null) =>
      upsert.mutateAsync({
        id: byName.get(name)?.id,
        name,
        category: CATEGORY,
        content_en: en,
        content_es: es ?? null,
        is_active: true,
      } as any);
    try {
      await put("sms", smsEn, smsEs);
      await put("email_subject", subject);
      await put("email_body", body);
      await put("sender_name", sender);
      await put("sms_consent_only", consentOnly ? "true" : "false");
      toast.success("Invitation defaults saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Invitations</CardTitle>
            <CardDescription>
              Default SMS and email text used when inviting workforce candidates to a posting.
              Merge fields: {"{first_name} {title} {pay} {start} {location} {link}"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="space-y-1">
              <Label>Default SMS (English)</Label>
              <Textarea rows={3} value={smsEn} onChange={(e) => setSmsEn(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Default SMS (Spanish)</Label>
              <Textarea rows={3} value={smsEs} onChange={(e) => setSmsEs(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email body</Label>
              <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Sender name</Label>
              <Input value={sender} onChange={(e) => setSender(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Default to “SMS consent only”</Label>
              <Switch checked={consentOnly} onCheckedChange={setConsentOnly} />
            </div>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save defaults
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
