import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Pencil, Check } from "lucide-react";

interface Props {
  /** Freshly generated description from buildTaskOrderDescription. */
  generated: string;
  /** Current stored description (may be user-edited). */
  value: string;
  /** True once the user has manually edited the description. */
  edited: boolean;
  /** Sets stored description and marks edited=true. */
  onEdit: (next: string) => void;
  /** Reset to generated (unmark edited). */
  onRegenerate: () => void;
}

// Resolve merge tags for preview display (server persists tags verbatim).
function renderPreview(text: string): string {
  return text
    .replace(/\{\{location\}\}/g, "[project location]")
    .replace(/\{\{start_date\}\}/g, "[start date]");
}

export function PostingPreviewSection({
  generated,
  value,
  edited,
  onEdit,
  onRegenerate,
}: Props) {
  const [editing, setEditing] = useState(false);

  // What ends up saved: user text if edited, otherwise the latest generated text.
  const displayed = edited ? value : generated;
  const preview = useMemo(() => renderPreview(displayed || ""), [displayed]);

  return (
    <Card className="border-primary/40">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Posting preview</p>
            {edited && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                edited
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {edited && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  onRegenerate();
                  setEditing(false);
                }}
              >
                Regenerate
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                if (editing) {
                  setEditing(false);
                } else {
                  // Seed textarea with current displayed text
                  if (!edited) onEdit(displayed);
                  setEditing(true);
                }
              }}
            >
              {editing ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" /> Done
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </>
              )}
            </Button>
          </div>
        </div>

        {editing ? (
          <Textarea
            rows={8}
            value={value}
            onChange={(e) => onEdit(e.target.value)}
            className="text-sm"
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {preview || (
              <span className="italic">
                Fill in the work summary and schedule to preview the auto-generated posting.
              </span>
            )}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          {edited
            ? "Your edited text will be saved as the posting description."
            : "Auto-generated from the fields above. Click Edit to customize."}
        </p>
      </CardContent>
    </Card>
  );
}
