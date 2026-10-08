import { formatApplicantLocation } from "@/lib/applicantLocation";
import { useApplicantLocations } from "@/hooks/useZipLookup";
import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, X, Star, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useAddCapabilityTag,
  useRemoveCapabilityTag,
  useClassifyApplicants,
  useWorkforceHistory,
  usePersonnelRatings,
  useUpdateApplicantFlags,
  useApplicantMessages,
  useApplicantInvites,
  useApplicantApplications,
  type CapabilityCategory,
  type WorkforceApplicant,
} from "@/integrations/supabase/hooks/useWorkforce";
import { RatingDialog, RatingStars } from "./RatingDialog";
import { PhotoLightbox, type LightboxPhoto } from "@/components/shared/PhotoLightbox";

interface Props {
  applicant: WorkforceApplicant | null;
  categories: CapabilityCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TimelineItem = { at: string; label: string; detail?: string | null; kind: string };

export function WorkforceApplicantDrawer({ applicant, categories, open, onOpenChange }: Props) {
  const resolveLocation = useApplicantLocations(open ? [applicant] : []);
  const [newCategory, setNewCategory] = useState<string>("");
  const [lightbox, setLightbox] = useState<LightboxPhoto | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{
    projectId: string | null;
    assignmentId: string | null;
    projectName: string | null;
  } | null>(null);
  const [dnrReason, setDnrReason] = useState<string>("");

  const addTag = useAddCapabilityTag();
  const removeTag = useRemoveCapabilityTag();
  const classify = useClassifyApplicants();
  const updateFlags = useUpdateApplicantFlags();

  const { data: history } = useWorkforceHistory();
  const link = applicant ? history?.links.get(applicant.id) : undefined;
  const assignments = applicant ? history?.historyByApplicant.get(applicant.id) ?? [] : [];
  const { data: ratings = [] } = usePersonnelRatings(link?.personnel_id);
  const { data: messages = [] } = useApplicantMessages(applicant?.id);
  const { data: invites = [] } = useApplicantInvites(applicant?.id);
  const { data: applications = [] } = useApplicantApplications(applicant?.id);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    for (const a of applications)
      items.push({
        at: a.created_at,
        kind: "Application",
        label: a.title ?? "Application",
        detail: a.status,
      });
    for (const i of invites)
      items.push({
        at: i.sent_at ?? "",
        kind: "Invite",
        label: "Invited to posting",
        detail: [
          i.opened_at ? "opened" : null,
          i.used_at ? "applied" : null,
        ].filter(Boolean).join(" · ") || "sent",
      });
    for (const m of messages)
      items.push({
        at: m.created_at,
        kind: m.channel === "email" ? "Email" : "SMS",
        label: (m.body ?? m.subject ?? "").slice(0, 120),
        detail: m.status,
      });
    for (const a of assignments)
      items.push({
        at: a.assigned_at ?? "",
        kind: "Assignment",
        label: a.project_name ?? "Project",
        detail: a.status,
      });
    for (const r of ratings)
      items.push({
        at: r.created_at,
        kind: "Rating",
        label: `${r.overall}/5${r.would_rehire ? "" : " · would not rehire"}`,
        detail: r.notes,
      });
    return items
      .filter((i) => i.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 40);
  }, [applications, invites, messages, assignments, ratings]);

  if (!applicant) return null;

  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <Avatar
              className="h-24 w-24 cursor-pointer"
              onClick={() =>
                applicant.photo_url &&
                setLightbox({
                  url: applicant.photo_url,
                  caption: `${applicant.first_name} ${applicant.last_name}`,
                })
              }
            >
              <AvatarImage src={applicant.photo_url ?? undefined} className="object-cover" />
              <AvatarFallback className="text-xl">
                {applicant.first_name?.[0]}
                {applicant.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <div>
                {applicant.first_name} {applicant.last_name}
              </div>
              <RatingStars value={link?.rating ?? null} className="mt-1" />
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-1 text-sm text-muted-foreground">
          <div>{applicant.phone ?? "No phone"}</div>
          <div>{applicant.email}</div>
          <div>{formatApplicantLocation(resolveLocation(applicant))}</div>
          <div>Status: {applicant.status}</div>
          {applicant.sms_opted_out && <div className="text-destructive">Opted out of SMS</div>}
          {applicant.last_application_at && (
            <div>
              Last application: {applicant.last_application_title ?? "—"} ·{" "}
              {format(new Date(applicant.last_application_at), "MMM d, yyyy")}
            </div>
          )}
        </div>

        <Separator className="my-4" />

        {/* Availability + do not rehire */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm">Availability</Label>
            <Select
              value={applicant.availability_status ?? "unknown"}
              onValueChange={(v) =>
                updateFlags.mutate({ id: applicant.id, availability_status: v })
              }
            >
              <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="on_assignment">On assignment</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Do not rehire</Label>
            <Switch
              checked={!!applicant.do_not_rehire}
              onCheckedChange={(v) =>
                updateFlags.mutate({
                  id: applicant.id,
                  do_not_rehire: v,
                  do_not_rehire_reason: v ? dnrReason || applicant.do_not_rehire_reason : null,
                })
              }
            />
          </div>
          {applicant.do_not_rehire && (
            <Input
              placeholder="Reason"
              defaultValue={applicant.do_not_rehire_reason ?? ""}
              onChange={(e) => setDnrReason(e.target.value)}
              onBlur={(e) =>
                updateFlags.mutate({ id: applicant.id, do_not_rehire_reason: e.target.value })
              }
            />
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
                    <Badge
                      variant={
                        tag.source === "verified"
                          ? "default"
                          : tag.source === "ai"
                          ? "outline"
                          : "secondary"
                      }
                    >
                      {tag.source === "verified" && <BadgeCheck className="mr-1 h-3 w-3" />}
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

        <div className="mt-3 flex items-center gap-2">
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

        <Separator className="my-4" />

        <h3 className="mb-2 font-medium">Work history</h3>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No FRG assignments yet.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.assignment_id} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{a.project_name ?? "Project"}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() =>
                      setRatingTarget({
                        projectId: a.project_id,
                        assignmentId: a.assignment_id,
                        projectName: a.project_name,
                      })
                    }
                  >
                    <Star className="mr-1 h-3.5 w-3.5" /> Rate
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.assigned_at ? format(new Date(a.assigned_at), "MMM d, yyyy") : "—"}
                  {a.unassigned_at ? ` – ${format(new Date(a.unassigned_at), "MMM d, yyyy")}` : " – present"}
                  {a.status ? ` · ${a.status}` : ""}
                  {a.pay_rate != null ? ` · $${a.pay_rate}/hr` : ""}
                  {a.work_classification ? ` · ${a.work_classification}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}

        {ratings.length > 0 && (
          <div className="mt-3 space-y-2">
            <h4 className="text-sm font-medium">Ratings</h4>
            {ratings.map((r) => (
              <div key={r.id} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <RatingStars value={r.overall} />
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "MMM d, yyyy")}
                  </span>
                </div>
                {!r.would_rehire && (
                  <Badge variant="destructive" className="mt-1 text-[10px]">
                    Would not rehire
                  </Badge>
                )}
                {r.notes && <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>}
              </div>
            ))}
          </div>
        )}

        <Separator className="my-4" />

        <h3 className="mb-2 font-medium">Timeline</h3>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <div className="space-y-2 pb-6">
            {timeline.map((t, i) => (
              <div key={`${t.kind}-${i}`} className="flex gap-2 text-sm">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">
                  {format(new Date(t.at), "MMM d, yyyy")}
                </span>
                <div className="min-w-0">
                  <Badge variant="outline" className="mr-2 text-[10px]">
                    {t.kind}
                  </Badge>
                  <span className="break-words">{t.label}</span>
                  {t.detail && (
                    <div className="text-xs text-muted-foreground">{t.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {ratingTarget && link?.personnel_id && (
          <RatingDialog
            open={!!ratingTarget}
            onOpenChange={(o) => !o && setRatingTarget(null)}
            personnelId={link.personnel_id}
            projectId={ratingTarget.projectId}
            assignmentId={ratingTarget.assignmentId}
            personName={`${applicant.first_name} ${applicant.last_name}`}
            projectName={ratingTarget.projectName}
          />
        )}

        <PhotoLightbox
          photos={lightbox ? [lightbox] : []}
          open={!!lightbox}
          onOpenChange={(o) => !o && setLightbox(null)}
        />
      </SheetContent>
    </Sheet>
  );
}
