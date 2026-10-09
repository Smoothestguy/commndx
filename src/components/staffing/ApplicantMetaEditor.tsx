import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Tags } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useUserRole } from "@/hooks/useUserRole";
import { invalidateApplicantQueries } from "@/hooks/useToggleApplicantStar";
import { ROLE_TAGS } from "@/lib/roleTags";

export function useUpdateApplicantMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      applicantId,
      patch,
    }: {
      applicantId: string;
      patch: { role_tags?: string[]; staff_notes?: string | null };
    }) => {
      const { error } = await supabase.from("applicants").update(patch).eq("id", applicantId);
      if (error) throw error;
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
    onSettled: () => invalidateApplicantQueries(qc),
  });
}

interface Props {
  applicantId?: string | null;
  roleTags?: string[] | null;
  staffNotes?: string | null;
}

/** Role tags + internal staff notes. Editable for admin/manager; read-only otherwise. */
export function ApplicantMetaEditor({ applicantId, roleTags, staffNotes }: Props) {
  const { isAdmin, isManager } = useUserRole();
  const canEdit = (isAdmin || isManager) && !!applicantId;
  const update = useUpdateApplicantMeta();
  const [tags, setTags] = useState<string[]>(roleTags ?? []);
  const [notes, setNotes] = useState(staffNotes ?? "");
  useEffect(() => setTags(roleTags ?? []), [roleTags]);
  useEffect(() => setNotes(staffNotes ?? ""), [staffNotes]);

  const toggleTag = (t: string) => {
    const next = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t];
    setTags(next);
    update.mutate({ applicantId: applicantId!, patch: { role_tags: next } });
  };
  const notesDirty = (notes.trim() || null) !== (staffNotes?.trim() || null);
  const saveNotes = () => {
    if (!notesDirty) return;
    update.mutate(
      { applicantId: applicantId!, patch: { staff_notes: notes.trim() || null } },
      { onSuccess: () => toast.success("Notes saved") },
    );
  };

  if (!canEdit && !tags.length && !notes) return null;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Suggested roles</Label>
        <div className="flex flex-wrap items-center gap-1">
          {tags.map((t) => (
            <Badge key={t} variant="secondary" className="font-normal">
              {t}
            </Badge>
          ))}
          {!tags.length && <span className="text-xs text-muted-foreground">None yet</span>}
          {canEdit && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                  <Tags className="h-3.5 w-3.5" /> Edit roles
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="space-y-1">
                  {ROLE_TAGS.map((t) => (
                    <label
                      key={t}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox checked={tags.includes(t)} onCheckedChange={() => toggleTag(t)} />
                      {t}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Staff notes (internal)</Label>
        {canEdit ? (
          <>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={3}
              placeholder="Visible to staff only"
            />
            {notesDirty && (
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={saveNotes} disabled={update.isPending}>
                <Check className="h-3.5 w-3.5" /> Save notes
              </Button>
            )}
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm">{notes}</p>
        )}
      </div>
    </div>
  );
}
