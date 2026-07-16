import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useApplicationFormTemplates } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import {
  useProjectRateBrackets,
  useAddRateBracket,
  useUpdateRateBracket,
} from "@/integrations/supabase/hooks/useProjectRateBrackets";
import {
  useCreateTaskOrder,
  useUpdateTaskOrder,
  useCreateJobPosting,
  useTaskOrderPositions,
  useReplaceTaskOrderPositions,
  TaskOrder,
} from "@/integrations/supabase/hooks/useStaffingApplications";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import {
  TaskOrderStepSchedule,
  ScheduleValue,
  emptySchedule,
} from "./TaskOrderStepSchedule";
import {
  TaskOrderStepPositions,
  PositionDraft,
} from "./TaskOrderStepPositions";
import { buildTaskOrderDescription } from "@/lib/taskOrderDescription";
import { PostingPreviewSection } from "./PostingPreviewSection";
import { resolvePositionDrafts } from "@/lib/resolvePositions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  taskOrder?: TaskOrder | null;
  defaultProjectId?: string;
  onCreated?: (taskOrder: TaskOrder, applicationUrl?: string) => void;
}

export function TaskOrderWizard({
  open,
  onOpenChange,
  mode,
  taskOrder,
  defaultProjectId,
  onCreated,
}: Props) {
  const [step, setStep] = useState(1);
  const isEdit = mode === "edit";

  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [startAt, setStartAt] = useState<string>("");
  const [approxDuration, setApproxDuration] = useState("");
  const [formTemplateId, setFormTemplateId] = useState<string>("");
  const [schedule, setSchedule] = useState<ScheduleValue>(emptySchedule);
  const [positions, setPositions] = useState<PositionDraft[]>([]);

  const { data: projects } = useProjects();
  const { data: formTemplates } = useApplicationFormTemplates();
  const { data: companySettings } = useCompanySettings();
  const { data: rateBrackets } = useProjectRateBrackets(projectId || undefined);
  const { data: existingPositions } = useTaskOrderPositions(
    isEdit ? taskOrder?.id : undefined
  );

  const createTaskOrder = useCreateTaskOrder();
  const updateTaskOrder = useUpdateTaskOrder();
  const createJobPosting = useCreateJobPosting();
  const addRateBracket = useAddRateBracket();
  const updateRateBracket = useUpdateRateBracket();
  const replacePositions = useReplaceTaskOrderPositions();

  const sortedTemplates = useMemo(() => {
    const list = (formTemplates ?? []).filter((t) => t.is_active);
    return [...list].sort((a, b) => {
      const af = a.name.toLowerCase().startsWith("frg standard") ? 0 : 1;
      const bf = b.name.toLowerCase().startsWith("frg standard") ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.name.localeCompare(b.name);
    });
  }, [formTemplates]);

  const defaultTemplateId = useMemo(() => {
    const preferred = (companySettings as any)?.default_form_template_id as
      | string
      | null
      | undefined;
    if (preferred && sortedTemplates.some((t) => t.id === preferred)) return preferred;
    const frg = sortedTemplates.find((t) =>
      t.name.toLowerCase().startsWith("frg standard")
    );
    return frg?.id || "";
  }, [companySettings, sortedTemplates]);

  const selectedTemplate = sortedTemplates.find((t) => t.id === formTemplateId);

  useEffect(() => {
    if (!open) return;
    if (isEdit && taskOrder) {
      setProjectId(taskOrder.project_id);
      setTitle(taskOrder.title || "");
      setJobDescription(taskOrder.job_description || "");
      setLocationAddress(taskOrder.location_address || "");
      setStartAt(
        taskOrder.start_at
          ? new Date(taskOrder.start_at).toISOString().slice(0, 16)
          : ""
      );
      setApproxDuration(taskOrder.approx_duration || "");
      setSchedule({
        workSummary: (taskOrder as any).work_summary || "",
        daysPerWeek:
          taskOrder.days_per_week != null ? String(taskOrder.days_per_week) : "",
        hoursPerDay:
          taskOrder.hours_per_day != null ? String(taskOrder.hours_per_day) : "",
        scheduleNotes: taskOrder.schedule_notes || "",
        perDiemAmount:
          taskOrder.per_diem_amount != null
            ? String(taskOrder.per_diem_amount)
            : "",
        perDiemNotes: taskOrder.per_diem_notes || "",
        lodgingStatus: taskOrder.lodging_status || "",
        lodgingNotes: taskOrder.lodging_notes || "",
        mealsProvided:
          taskOrder.meals_provided == null
            ? ""
            : taskOrder.meals_provided
            ? "yes"
            : "no",
        mealsNotes: taskOrder.meals_notes || "",
        mobDemobPaid:
          taskOrder.mob_demob_paid == null
            ? ""
            : taskOrder.mob_demob_paid
            ? "yes"
            : "no",
        mobDemobNotes: taskOrder.mob_demob_notes || "",
      });
    } else {
      setProjectId(defaultProjectId || "");
      setTitle("");
      setJobDescription("");
      setLocationAddress("");
      setStartAt("");
      setApproxDuration("");
      setSchedule(emptySchedule);
      setPositions([]);
    }
    setStep(1);
  }, [open, isEdit, taskOrder, defaultProjectId]);

  // Default template selection on new creates
  useEffect(() => {
    if (!open || isEdit) return;
    if (!formTemplateId && defaultTemplateId) setFormTemplateId(defaultTemplateId);
  }, [open, isEdit, defaultTemplateId, formTemplateId]);

  useEffect(() => {
    if (!open || !isEdit) return;
    if (existingPositions) {
      setPositions(
        existingPositions.map((p) => ({
          _key: p.id,
          id: p.id,
          rate_bracket_id: p.rate_bracket_id,
          position_label: p.position_label,
          headcount: p.headcount,
          advertised_pay_rate: p.advertised_pay_rate,
          show_pay_publicly: p.show_pay_publicly,
          notes: p.notes,
        }))
      );
    }
  }, [open, isEdit, existingPositions]);

  const handleGenerateDescription = () => {
    if (jobDescription.trim().length > 0) {
      if (!window.confirm("Replace the existing Job Description?")) return;
    }
    setJobDescription(
      buildTaskOrderDescription({
        title,
        workSummary: schedule.workSummary,
        locationAddress,
        city: (() => {
          // Try to parse "…, City, ST zip" for city hint
          const parts = locationAddress.split(",").map((s) => s.trim()).filter(Boolean);
          return parts.length >= 2 ? parts[parts.length - 2] : "";
        })(),
        startAt: startAt || null,
        approxDuration,
        daysPerWeek: schedule.daysPerWeek,
        hoursPerDay: schedule.hoursPerDay,
        scheduleNotes: schedule.scheduleNotes,
        perDiemAmount: schedule.perDiemAmount,
        perDiemNotes: schedule.perDiemNotes,
        lodgingStatus: schedule.lodgingStatus,
        lodgingNotes: schedule.lodgingNotes,
        mealsProvided: schedule.mealsProvided,
        mealsNotes: schedule.mealsNotes,
        mobDemobPaid: schedule.mobDemobPaid,
        mobDemobNotes: schedule.mobDemobNotes,
        positions: positions.map((p) => ({
          position_label: p.position_label,
          headcount: p.headcount,
          advertised_pay_rate: p.advertised_pay_rate,
          show_pay_publicly: p.show_pay_publicly,
        })),
      })
    );
    toast.success("Description generated. Edit as needed.");
  };

  const workSummaryMissing = !schedule.workSummary.trim();
  const positionPayInvalid = positions.some(
    (p) => p.show_pay_publicly && p.advertised_pay_rate == null
  );
  const [showWorkSummaryError, setShowWorkSummaryError] = useState(false);
  const [showPositionErrors, setShowPositionErrors] = useState(false);

  const canGoNext = () => {
    if (step === 1) return !!projectId && title.trim().length > 0;
    if (step === 2) return !workSummaryMissing;
    return true;
  };

  const buildTaskOrderPayload = () => {
    const daysNum =
      schedule.daysPerWeek === "" ? null : parseInt(schedule.daysPerWeek, 10);
    const hoursNum =
      schedule.hoursPerDay === "" ? null : parseFloat(schedule.hoursPerDay);
    const perDiemNum =
      schedule.perDiemAmount === "" ? null : parseFloat(schedule.perDiemAmount);
    return {
      title: title.trim(),
      job_description: jobDescription.trim() || null,
      work_summary: schedule.workSummary.trim() || null,
      location_address: locationAddress.trim() || null,
      start_at: startAt ? new Date(startAt).toISOString() : null,
      approx_duration: approxDuration.trim() || null,
      days_per_week: daysNum != null && !isNaN(daysNum) ? daysNum : null,
      hours_per_day: hoursNum != null && !isNaN(hoursNum) ? hoursNum : null,
      schedule_notes: schedule.scheduleNotes.trim() || null,
      per_diem_amount:
        perDiemNum != null && !isNaN(perDiemNum) ? perDiemNum : null,
      per_diem_notes: schedule.perDiemNotes.trim() || null,
      lodging_status: (schedule.lodgingStatus || null) as
        | "provided"
        | "stipend"
        | "not_provided"
        | null,
      lodging_notes: schedule.lodgingNotes.trim() || null,
      meals_provided:
        schedule.mealsProvided === "" ? null : schedule.mealsProvided === "yes",
      meals_notes: schedule.mealsNotes.trim() || null,
      mob_demob_paid:
        schedule.mobDemobPaid === "" ? null : schedule.mobDemobPaid === "yes",
      mob_demob_notes: schedule.mobDemobNotes.trim() || null,
    };
  };

  const handleSave = async () => {
    if (!projectId || !title.trim()) {
      toast.error("Please fill in required fields");
      setStep(1);
      return;
    }
    if (workSummaryMissing) {
      setShowWorkSummaryError(true);
      setStep(2);
      toast.error("Add a short description of what workers will be doing.");
      return;
    }
    if (positionPayInvalid) {
      setShowPositionErrors(true);
      setStep(3);
      toast.error("Enter a pay rate for each position with \"Show Pay\" on, or turn it off.");
      return;
    }

    try {
      const payload = buildTaskOrderPayload();
      const resolvedPositions =
        positions.length > 0
          ? await resolvePositionDrafts({
              projectId,
              positions,
              rateBrackets,
              addRateBracket,
              updateRateBracket,
            })
          : [];
      const headcountSum = resolvedPositions.reduce((s, p) => s + p.headcount, 0);

      if (isEdit && taskOrder) {
        await updateTaskOrder.mutateAsync({
          id: taskOrder.id,
          ...payload,
          ...(resolvedPositions.length > 0
            ? { headcount_needed: headcountSum }
            : {}),
        });
        if (positions.length > 0 || (existingPositions?.length ?? 0) > 0) {
          await replacePositions.mutateAsync({
            taskOrderId: taskOrder.id,
            positions: resolvedPositions,
          });
        }
        toast.success("Task order updated");
        onOpenChange(false);
      } else {
        const created = await createTaskOrder.mutateAsync({
          project_id: projectId,
          status: "open",
          headcount_needed: resolvedPositions.length > 0 ? headcountSum : 1,
          location_lat: null,
          location_lng: null,
          ...payload,
        } as any);

        if (resolvedPositions.length > 0) {
          await replacePositions.mutateAsync({
            taskOrderId: created.id,
            positions: resolvedPositions,
          });
        }

        const posting = await createJobPosting.mutateAsync({
          taskOrderId: created.id,
          formTemplateId: formTemplateId || undefined,
        });
        const publicUrl = `${window.location.origin}/apply/${posting.public_token}`;
        try {
          await navigator.clipboard.writeText(publicUrl);
        } catch {
          /* ignore */
        }
        toast.success("Task order created — application link copied.");
        onCreated?.(created as unknown as TaskOrder, publicUrl);
        onOpenChange(false);
      }
    } catch (err: any) {
      console.error("[TaskOrderWizard] save error:", err);
      toast.error(err?.message || "Failed to save task order");
    }
  };

  const stepLabels = ["Basics", "Schedule & Site", "Positions"];
  const projectLocked = isEdit || (!isEdit && !!defaultProjectId);

  const saving =
    createTaskOrder.isPending ||
    updateTaskOrder.isPending ||
    replacePositions.isPending ||
    addRateBracket.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Task Order" : "New Task Order"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details, schedule, and positions."
              : "Create a staffing request and generate an application link."}
          </DialogDescription>
          <div className="flex items-center gap-2 pt-2">
            {stepLabels.map((label, idx) => {
              const num = idx + 1;
              const active = num === step;
              const done = num < step;
              return (
                <div key={label} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(num)}
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : done
                        ? "bg-muted text-foreground"
                        : "bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/40 text-[10px]">
                      {num}
                    </span>
                    {label}
                  </button>
                  {idx < stepLabels.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Project *</Label>
                <Select
                  value={projectId}
                  onValueChange={setProjectId}
                  disabled={projectLocked}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Task Order Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Convention Center Load-In, Week 12 Crew"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Job Description</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleGenerateDescription}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Generate description
                  </Button>
                </div>
                <Textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Describe the scope of work…"
                  rows={5}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  placeholder="Job site address"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Start Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Approx Duration</Label>
                  <Input
                    value={approxDuration}
                    onChange={(e) => setApproxDuration(e.target.value)}
                    placeholder="e.g., 2-3 weeks"
                  />
                </div>
              </div>
              {!isEdit && (
                <div>
                  <Label>Application Form Template</Label>
                  <Select
                    value={formTemplateId || "none"}
                    onValueChange={(v) =>
                      setFormTemplateId(v === "none" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No custom form (basic fields only)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        No custom form (basic fields only)
                      </SelectItem>
                      {sortedTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.fields.length} fields)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate?.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedTemplate.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <TaskOrderStepSchedule
              value={schedule}
              onChange={(patch) => setSchedule((s) => ({ ...s, ...patch }))}
              workSummaryRequired
              workSummaryError={
                showWorkSummaryError && workSummaryMissing
                  ? "Required — applicants need to know what they'll be doing."
                  : null
              }
            />
          )}

          {step === 3 && (
            <div className="space-y-4">
              <TaskOrderStepPositions
                positions={positions}
                onChange={setPositions}
                rateBrackets={rateBrackets}
                projectSelected={!!projectId}
                showErrors={showPositionErrors}
              />
              <PostingPreviewSection
                generated={buildTaskOrderDescription({
                  title,
                  workSummary: schedule.workSummary,
                  locationAddress,
                  city: (() => {
                    const parts = locationAddress.split(",").map((s) => s.trim()).filter(Boolean);
                    return parts.length >= 2 ? parts[parts.length - 2] : "";
                  })(),
                  startAt: startAt || null,
                  approxDuration,
                  daysPerWeek: schedule.daysPerWeek,
                  hoursPerDay: schedule.hoursPerDay,
                  scheduleNotes: schedule.scheduleNotes,
                  perDiemAmount: schedule.perDiemAmount,
                  perDiemNotes: schedule.perDiemNotes,
                  lodgingStatus: schedule.lodgingStatus,
                  lodgingNotes: schedule.lodgingNotes,
                  mealsProvided: schedule.mealsProvided,
                  mealsNotes: schedule.mealsNotes,
                  mobDemobPaid: schedule.mobDemobPaid,
                  mobDemobNotes: schedule.mobDemobNotes,
                  positions: positions.map((p) => ({
                    position_label: p.position_label,
                    headcount: p.headcount,
                    advertised_pay_rate: p.advertised_pay_rate,
                    show_pay_publicly: p.show_pay_publicly,
                  })),
                })}
                value={jobDescription}
                edited={jobDescription.trim().length > 0}
                onEdit={(t) => setJobDescription(t)}
                onRegenerate={() => setJobDescription("")}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-2 sm:justify-between">
          <div className="flex gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                type="button"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canGoNext()}
                type="button"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving} type="button">
                {isEdit ? "Save Changes" : "Create & Copy Link"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
