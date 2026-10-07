import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Award, ChevronDown, FileText, Loader2, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const CERT_TYPES = [
  "Forklift", "OSHA 10", "OSHA 30", "CDL", "TWIC", "First Aid/CPR", "Flagger", "Welding", "Other",
] as const;

export const CERT_BUCKET = "application-files";

export interface CertEntry {
  id: string;
  cert_type: string;
  other_label: string;
  expires_on: string;
  file_path: string | null;
  file_name: string | null;
  uploading?: boolean;
}

const MAX = 10 * 1024 * 1024;

interface Props {
  entries: CertEntry[];
  onChange: (next: CertEntry[] | ((prev: CertEntry[]) => CertEntry[])) => void;
}

export function CertificationsFormSection({ entries, onChange }: Props) {
  const [open, setOpen] = useState(entries.length > 0);

  const update = (id: string, patch: Partial<CertEntry>) =>
    onChange((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const add = () => {
    setOpen(true);
    onChange((prev) => [
      ...prev,
      { id: crypto.randomUUID(), cert_type: "", other_label: "", expires_on: "", file_path: null, file_name: null },
    ]);
  };

  const upload = async (id: string, file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX) return toast.error("File too large (max 10MB)");
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      return toast.error("Please upload an image or PDF");
    }
    update(id, { uploading: true });
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `certifications/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { error } = await supabase.storage
        .from(CERT_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      update(id, { file_path: path, file_name: file.name, uploading: false });
    } catch (e) {
      console.warn("[Certifications] upload failed", e);
      toast.error("Couldn't upload that file — you can still submit without it.");
      update(id, { uploading: false });
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border p-4 space-y-3">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-start justify-between gap-3 text-left">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Award className="h-4 w-4" /> Certifications (optional)
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Have a forklift card, OSHA card, or other certification? Adding it helps us place you faster.
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 mt-1 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3">
        {entries.map((e) => (
          <div key={e.id} className="relative rounded-md border bg-muted/30 p-3 space-y-3">
            <Button
              type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7"
              onClick={() => onChange((prev) => prev.filter((x) => x.id !== e.id))}
              aria-label="Remove certification"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="grid gap-3 sm:grid-cols-2 pr-8">
              <div className="space-y-1">
                <Label>Certification</Label>
                <Select value={e.cert_type} onValueChange={(v) => update(e.id, { cert_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {CERT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {e.cert_type === "Other" && (
                <div className="space-y-1">
                  <Label>Which certification?</Label>
                  <Input value={e.other_label} maxLength={100}
                    onChange={(ev) => update(e.id, { other_label: ev.target.value })} />
                </div>
              )}
              <div className="space-y-1">
                <Label>Expiration date (optional)</Label>
                <Input type="date" value={e.expires_on}
                  onChange={(ev) => update(e.id, { expires_on: ev.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Photo or PDF (optional)</Label>
                {e.file_path ? (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{e.file_name}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => update(e.id, { file_path: null, file_name: null })}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : e.uploading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                  </div>
                ) : (
                  <Input type="file" accept="image/*,application/pdf"
                    onChange={(ev) => upload(e.id, ev.target.files?.[0])} />
                )}
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Add certification
        </Button>
      </CollapsibleContent>
      {!open && entries.length === 0 && (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Add certification
        </Button>
      )}
    </Collapsible>
  );
}

/** Best-effort insert; never throws. Anon has INSERT only, so no `.select()`. */
export async function saveCertifications(
  entries: CertEntry[],
  applicationId: string | null | undefined,
  applicantId: string | null | undefined,
) {
  const rows = entries
    .filter((e) => e.cert_type)
    .map((e) => ({
      application_id: applicationId as string,
      applicant_id: applicantId ?? null,
      cert_type: e.cert_type,
      other_label: e.cert_type === "Other" ? e.other_label.trim() || null : null,
      expires_on: e.expires_on || null,
      file_path: e.file_path,
    }));
  if (!rows.length || !applicationId) return;
  try {
    const { error } = await supabase.from("applicant_certifications").insert(rows);
    if (error) throw error;
  } catch (err) {
    console.warn("[Certifications] insert failed (non-blocking)", err);
  }
}
