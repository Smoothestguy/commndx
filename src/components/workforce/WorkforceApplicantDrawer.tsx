import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useAddCapabilityTag,
  useRemoveCapabilityTag,
  useClassifyApplicants,
  type CapabilityCategory,
  type WorkforceApplicant,
} from "@/integrations/supabase/hooks/useWorkforce";

interface Props {
  applicant: WorkforceApplicant | null;
  categories: CapabilityCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkforceApplicantDrawer({ applicant, categories, open, onOpenChange }: Props) {
  const [newCategory, setNewCategory] = useState<string>("");
  const addTag = useAddCapabilityTag();
  const removeTag = useRemoveCapabilityTag();
  const classify = useClassifyApplicants();

  if (!applicant) return null;

  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={applicant.photo_url ?? undefined} />
              <AvatarFallback>
                {applicant.first_name?.[0]}
                {applicant.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <span>
              {applicant.first_name} {applicant.last_name}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-1 text-sm text-muted-foreground">
          <div>{applicant.phone ?? "No phone"}</div>
          <div>{applicant.email}</div>
          <div>{[applicant.city, applicant.state].filter(Boolean).join(", ") || "No location"}</div>
          <div>Status: {applicant.status}</div>
          {applicant.last_application_at && (
            <div>
              Last application: {applicant.last_application_title ?? "—"} ·{" "}
              {format(new Date(applicant.last_application_at), "MMM d, yyyy")}
            </div>
          )}
        </div>

        <Separator className="my-4" />

        <div className="flex items-center justify-between">
          <h3 className="font-medium">Capabilities</h3>
          <Button
            size="sm"
            variant="outline"
            disabled={classify.isPending}
            onClick={async () => {
              const res = await classify.mutateAsync({
                applicant_ids: [applicant.id],
                force_reclassify: true,
                chain: false,
              });
              if (res?.paused) toast.warning(res.reason ?? "Classification paused");
              else toast.success("Reclassified");
            }}
          >
            {classify.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="ml-2">Reclassify with AI</span>
          </Button>
        </div>

        <div className="mt-3 space-y-2">
          {applicant.tags.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No categories yet. Categories are AI-suggested from application answers and can be
              corrected here.
            </p>
          )}
          {applicant.tags.map((tag) => {
            const cat = byId.get(tag.category_id);
            return (
              <div key={tag.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={tag.source === "ai" ? "outline" : "default"}>
                      {cat?.name ?? "Unknown"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {tag.source}
                      {tag.confidence != null && ` · ${Math.round(tag.confidence * 100)}%`}
                      {tag.years_experience != null && ` · ${tag.years_experience}y`}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => removeTag.mutate(tag.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {tag.evidence && (
                  <p className="mt-1 text-xs text-muted-foreground">{tag.evidence}</p>
                )}
              </div>
            );
          })}
        </div>

        <Separator className="my-4" />

        <div className="flex items-center gap-2">
          <Select value={newCategory} onValueChange={setNewCategory}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Add category…" />
            </SelectTrigger>
            <SelectContent>
              {categories
                .filter((c) => !applicant.tags.some((t) => t.category_id === c.id))
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!newCategory || addTag.isPending}
            onClick={() => {
              addTag.mutate(
                { applicant_id: applicant.id, category_id: newCategory },
                { onSuccess: () => setNewCategory("") }
              );
            }}
          >
            Add
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
