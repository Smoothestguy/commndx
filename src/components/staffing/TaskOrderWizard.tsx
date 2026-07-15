import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
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
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import {
  useApplicationFormTemplates,
} from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import {
  useProjectRateBrackets,
  useAddRateBracket,
  useUpdateRateBracket,
  ProjectRateBracket,
} from "@/integrations/supabase/hooks/useProjectRateBrackets";
import {
  useCreateTaskOrder,
  useUpdateTaskOrder,
  useCreateJobPosting,
  useTaskOrderPositions,
  useReplaceTaskOrderPositions,
  TaskOrder,
  TaskOrderPositionInput,
} from "@/integrations/supabase/hooks/useStaffingApplications";

interface PositionDraft extends TaskOrderPositionInput {
  _key: string;
  _isNewBracket?: boolean;
  _newBracketName?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  taskOrder?: TaskOrder | null; // required in edit mode
  defaultProjectId?: string;
  onCreated?: (taskOrder: TaskOrder, applicationUrl?: string) => void;
}

const NEW_BRACKET_VALUE = "__new__";

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

  // Basics
  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [startAt, setStartAt] = useState<string>(""); // datetime-local
  const [approxDuration, setApproxDuration] = useState("");
  const [formTemplateId, setFormTemplateId] = useState<string>("");

  // Schedule & Site
  const [daysPerWeek, setDaysPerWeek] = useState<string>("");
  const [hoursPerDay, setHoursPerDay] = useState<string>("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [perDiemAmount, setPerDiemAmount] = useState<string>("");
  const [perDiemNotes, setPerDiemNotes] = useState("");
  const [lodgingStatus, setLodgingStatus] = useState<string>("");
  const [lodgingNotes, setLodgingNotes] = useState("");
  const [mealsProvided, setMealsProvided] = useState<string>(""); // "yes"|"no"|""
  const [mealsNotes, setMealsNotes] = useState("");
  const [mobDemobPaid, setMobDemobPaid] = useState<string>(""); // "yes"|"no"|""
  const [mobDemobNotes, setMobDemobNotes] = useState("");

  // Positions
  const [positions, setPositions] = useState<PositionDraft[]>([]);

  const { data: projects } = useProjects();
  const { data: formTemplates } = useApplicationFormTemplates();
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

  // Initialize state when opening / when task order or existing positions load
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
      setDaysPerWeek(
        taskOrder.days_per_week != null ? String(taskOrder.days_per_week) : ""
      );
      setHoursPerDay(
        taskOrder.hours_per_day != null ? String(taskOrder.hours_per_day) : ""
      );
      setScheduleNotes(taskOrder.schedule_notes || "");
      setPerDiemAmount(
        taskOrder.per_diem_amount != null
          ? String(taskOrder.per_diem_amount)
          : ""
      );
      setPerDiemNotes(taskOrder.per_diem_notes || "");
      setLodgingStatus(taskOrder.lodging_status || "");
      setLodgingNotes(taskOrder.lodging_notes || "");
      setMealsProvided(
        taskOrder.meals_provided == null
          ? ""
          : taskOrder.meals_provided
          ? "yes"
          : "no"
      );
      setMealsNotes(taskOrder.meals_notes || "");
      setMobDemobPaid(
        taskOrder.mob_demob_paid == null
          ? ""
          : taskOrder.mob_demob_paid
          ? "yes"
          : "no"
      );
      setMobDemobNotes(taskOrder.mob_demob_notes || "");
    } else {
      setProjectId(defaultProjectId || "");
      setTitle("");
      setJobDescription("");
      setLocationAddress("");
      setStartAt("");
      setApproxDuration("");
      setFormTemplateId("");
      setDaysPerWeek("");
      setHoursPerDay("");
      setScheduleNotes("");
      setPerDiemAmount("");
      setPerDiemNotes("");
      setLodgingStatus("");
      setLodgingNotes("");
      setMealsProvided("");
      setMealsNotes("");
      setMobDemobPaid("");
      setMobDemobNotes("");
      setPositions([]);
    }
    setStep(1);
  }, [open, isEdit, taskOrder, defaultProjectId]);

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

  const totalHeadcount = useMemo(
    () => positions.reduce((sum, p) => sum + (Number(p.headcount) || 0), 0),
    [positions]
  );

  const sortedTemplates = useMemo(() => {
    const list = (formTemplates ?? []).filter((t) => t.is_active);
    return [...list].sort((a, b) => {
      const af = a.name.toLowerCase().startsWith("frg standard") ? 0 : 1;
      const bf = b.name.toLowerCase().startsWith("frg standard") ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.name.localeCompare(b.name);
    });
  }, [formTemplates]);

  const selectedTemplate = sortedTemplates.find((t) => t.id === formTemplateId);

  const buildDescription = () => {
    const parts: string[] = [];
    const loc = locationAddress.trim();
    parts.push(
      `${title.trim() || "Task Order"}${loc ? ` in ${loc}` : ""}.`
    );
    const sched: string[] = [];
    if (startAt) {
      try {
        const d = new Date(startAt);
        sched.push(`Starts ${d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`);
      } catch { /* ignore */ }
    }
    if (approxDuration.trim()) sched.push(`runs approximately ${approxDuration.trim()}`);
    const dpw = daysPerWeek ? parseInt(daysPerWeek, 10) : null;
    const hpd = hoursPerDay ? parseFloat(hoursPerDay) : null;
    if (dpw) sched.push(`${dpw} day${dpw === 1 ? "" : "s"}/week`);
    if (hpd) sched.push(`${hpd} hrs/day`);
    if (sched.length) parts.push(sched.join(", ") + ".");
    if (scheduleNotes.trim()) parts.push(scheduleNotes.trim());

    const comp: string[] = [];
    const publicPositions = positions.filter(
      (p) => p.show_pay_publicly && p.advertised_pay_rate != null && p.position_label
    );
    if (publicPositions.length) {
      comp.push(
        "Positions: " +
          publicPositions
            .map((p) => `${p.position_label} ($${p.advertised_pay_rate}/hr${p.headcount > 1 ? `, x${p.headcount}` : ""})`)
            .join("; ")
      );
    }
    const perDiemNum = perDiemAmount ? parseFloat(perDiemAmount) : null;
    if (perDiemNum) comp.push(`Per diem $${perDiemNum}/day${perDiemNotes.trim() ? ` (${perDiemNotes.trim()})` : ""}`);
    if (lodgingStatus === "provided") comp.push(`Lodging provided${lodgingNotes.trim() ? ` (${lodgingNotes.trim()})` : ""}`);
    else if (lodgingStatus === "stipend") comp.push(`Lodging stipend${lodgingNotes.trim() ? ` (${lodgingNotes.trim()})` : ""}`);
    else if (lodgingStatus === "not_provided") comp.push("Lodging not provided");
    if (mealsProvided === "yes") comp.push(`Meals provided${mealsNotes.trim() ? ` (${mealsNotes.trim()})` : ""}`);
    else if (mealsProvided === "no") comp.push("Meals not provided");
    if (mobDemobPaid === "yes") comp.push(`Mob/demob time paid${mobDemobNotes.trim() ? ` (${mobDemobNotes.trim()})` : ""}`);
    else if (mobDemobPaid === "no") comp.push("Mob/demob time not paid");
    if (comp.length) parts.push(comp.join(". ") + ".");

    parts.push("Apply below — it takes about 2 minutes.");
    return parts.filter(Boolean).join("\n\n");
  };

  const handleGenerateDescription = () => {
    if (jobDescription.trim().length > 0) {
      if (!window.confirm("Replace the existing Job Description?")) return;
    }
    setJobDescription(buildDescription());
    toast.success("Description generated. Edit as needed.");
  };


  const addPositionRow = () => {
    setPositions((prev) => [
      ...prev,
      {
        _key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        rate_bracket_id: null,
        position_label: "",
        headcount: 1,
        advertised_pay_rate: null,
        show_pay_publicly: true,
        notes: null,
      },
    ]);
  };

  const removePositionRow = (key: string) => {
    setPositions((prev) => prev.filter((p) => p._key !== key));
  };

  const updatePos = (key: string, patch: Partial<PositionDraft>) => {
    setPositions((prev) =>
      prev.map((p) => (p._key === key ? { ...p, ...patch } : p))
    );
  };

  const handleBracketSelect = (key: string, val: string) => {
    if (val === NEW_BRACKET_VALUE) {
      setPositions((prev) =>
        prev.map((p) =>
          p._key === key
            ? {
                ...p,
                rate_bracket_id: null,
                _isNewBracket: true,
                _newBracketName: "",
                position_label: "",
              }
            : p
        )
      );
      return;
    }
    const bracket = rateBrackets?.find((b) => b.id === val);
    setPositions((prev) =>
      prev.map((p) => {
        if (p._key !== key) return p;
        // Prefill pay from bracket default only when current pay is empty
        const nextPay =
          p.advertised_pay_rate == null && bracket?.default_pay_rate != null
            ? bracket.default_pay_rate
            : p.advertised_pay_rate;
        return {
          ...p,
          rate_bracket_id: val,
          _isNewBracket: false,
          _newBracketName: undefined,
          position_label: bracket?.name || p.position_label,
          advertised_pay_rate: nextPay ?? null,
        };
      })
    );
  };

  const canGoNext = () => {
    if (step === 1) {
      return !!projectId && title.trim().length > 0;
    }
    return true;
  };

  const buildTaskOrderPayload = () => {
    const daysNum = daysPerWeek === "" ? null : parseInt(daysPerWeek, 10);
    const hoursNum = hoursPerDay === "" ? null : parseFloat(hoursPerDay);
    const perDiemNum =
      perDiemAmount === "" ? null : parseFloat(perDiemAmount);
    return {
      title: title.trim(),
      job_description: jobDescription.trim() || null,
      location_address: locationAddress.trim() || null,
      start_at: startAt ? new Date(startAt).toISOString() : null,
      approx_duration: approxDuration.trim() || null,
      days_per_week:
        daysNum != null && !isNaN(daysNum) ? daysNum : null,
      hours_per_day:
        hoursNum != null && !isNaN(hoursNum) ? hoursNum : null,
      schedule_notes: scheduleNotes.trim() || null,
      per_diem_amount:
        perDiemNum != null && !isNaN(perDiemNum) ? perDiemNum : null,
      per_diem_notes: perDiemNotes.trim() || null,
      lodging_status: (lodgingStatus || null) as
        | "provided"
        | "stipend"
        | "not_provided"
        | null,
      lodging_notes: lodgingNotes.trim() || null,
      meals_provided:
        mealsProvided === "" ? null : mealsProvided === "yes",
      meals_notes: mealsNotes.trim() || null,
      mob_demob_paid:
        mobDemobPaid === "" ? null : mobDemobPaid === "yes",
      mob_demob_notes: mobDemobNotes.trim() || null,
    };
  };

  const resolvePositions = async (
    projectIdForBrackets: string
  ): Promise<TaskOrderPositionInput[]> => {
    // Resolve inline "new" brackets first, and write back default_pay_rate when appropriate
    const resolved: TaskOrderPositionInput[] = [];
    for (const p of positions) {
      let bracketId = p.rate_bracket_id;
      let label = p.position_label.trim();
      const payRate = p.advertised_pay_rate;

      if (p._isNewBracket) {
        const name = (p._newBracketName || label || "").trim();
        if (!name) {
          throw new Error("Please name each new position bracket.");
        }
        const created = await addRateBracket.mutateAsync({
          project_id: projectIdForBrackets,
          name,
          default_pay_rate: payRate ?? null,
        });
        bracketId = created.id;
        label = name;
      } else if (bracketId) {
        // If bracket has no default_pay_rate yet but user typed one, save it back
        const bracket = rateBrackets?.find((b) => b.id === bracketId) as
          | ProjectRateBracket
          | undefined;
        if (
          bracket &&
          (bracket.default_pay_rate == null ||
            Number(bracket.default_pay_rate) === 0) &&
          payRate != null &&
          !Number.isNaN(payRate)
        ) {
          try {
            await updateRateBracket.mutateAsync({
              id: bracket.id,
              default_pay_rate: payRate,
            });
          } catch (e) {
            console.warn("Could not backfill default_pay_rate", e);
          }
        }
        if (!label) label = bracket?.name || "";
      }

      if (!label) {
        throw new Error("Each position needs a label.");
      }
      if (!p.headcount || p.headcount < 1) {
        throw new Error("Each position needs a headcount of 1 or more.");
      }

      resolved.push({
        id: p.id,
        rate_bracket_id: bracketId,
        position_label: label,
        headcount: Math.floor(p.headcount),
        advertised_pay_rate:
          payRate != null && !Number.isNaN(payRate) ? payRate : null,
        show_pay_publicly: p.show_pay_publicly,
        notes: p.notes && p.notes.trim() ? p.notes.trim() : null,
      });
    }
    return resolved;
  };

  const handleSave = async () => {
    if (!projectId || !title.trim()) {
      toast.error("Please fill in required fields");
      setStep(1);
      return;
    }

    try {
      const payload = buildTaskOrderPayload();
      const resolvedPositions =
        positions.length > 0 ? await resolvePositions(projectId) : [];
      const headcountSum = resolvedPositions.reduce(
        (s, p) => s + p.headcount,
        0
      );

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
          headcount_needed:
            resolvedPositions.length > 0 ? headcountSum : 1,
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
  const projectLocked = isEdit || (!isEdit && !!defaultProjectId); // lock in edit, or when launched from a project context

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
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Days per Week</Label>
                  <Input
                    type="number"
                    min={1}
                    max={7}
                    value={daysPerWeek}
                    onChange={(e) => setDaysPerWeek(e.target.value)}
                    placeholder="e.g., 5"
                  />
                </div>
                <div>
                  <Label>Hours per Day</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.25"
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(e.target.value)}
                    placeholder="e.g., 10"
                  />
                </div>
              </div>
              <div>
                <Label>Schedule Notes</Label>
                <Textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="Shift times, days off, overtime expectations…"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Per Diem ($/day)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={perDiemAmount}
                    onChange={(e) => setPerDiemAmount(e.target.value)}
                    placeholder="e.g., 60"
                  />
                </div>
                <div>
                  <Label>Per Diem Notes</Label>
                  <Input
                    value={perDiemNotes}
                    onChange={(e) => setPerDiemNotes(e.target.value)}
                    placeholder="Paid daily, receipts required, etc."
                  />
                </div>
              </div>

              <div>
                <Label>Lodging</Label>
                <RadioGroup
                  value={lodgingStatus || "none"}
                  onValueChange={(v) =>
                    setLodgingStatus(v === "none" ? "" : v)
                  }
                  className="flex flex-wrap gap-4 pt-1"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="none" />
                    Unspecified
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="provided" />
                    Provided
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="stipend" />
                    Stipend
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="not_provided" />
                    Not provided
                  </label>
                </RadioGroup>
                <Input
                  className="mt-2"
                  value={lodgingNotes}
                  onChange={(e) => setLodgingNotes(e.target.value)}
                  placeholder="Lodging notes"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Meals Provided</Label>
                  <RadioGroup
                    value={mealsProvided || "unset"}
                    onValueChange={(v) =>
                      setMealsProvided(v === "unset" ? "" : v)
                    }
                    className="flex gap-4 pt-1"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="unset" />
                      Unspecified
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="yes" />
                      Yes
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="no" />
                      No
                    </label>
                  </RadioGroup>
                  <Input
                    className="mt-2"
                    value={mealsNotes}
                    onChange={(e) => setMealsNotes(e.target.value)}
                    placeholder="Meals notes"
                  />
                </div>
                <div>
                  <Label>Mob/Demob Time Paid</Label>
                  <RadioGroup
                    value={mobDemobPaid || "unset"}
                    onValueChange={(v) =>
                      setMobDemobPaid(v === "unset" ? "" : v)
                    }
                    className="flex gap-4 pt-1"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="unset" />
                      Unspecified
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="yes" />
                      Yes
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="no" />
                      No
                    </label>
                  </RadioGroup>
                  <Input
                    className="mt-2"
                    value={mobDemobNotes}
                    onChange={(e) => setMobDemobNotes(e.target.value)}
                    placeholder="Mob/demob notes"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Positions</p>
                  <p className="text-xs text-muted-foreground">
                    Add each role needed for this task order. Total headcount:{" "}
                    <span className="font-semibold">{totalHeadcount}</span>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPositionRow}
                  disabled={!projectId}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Position
                </Button>
              </div>

              {!projectId && (
                <p className="text-xs text-muted-foreground">
                  Select a project on Step 1 before adding positions.
                </p>
              )}

              {positions.length === 0 && projectId && (
                <div className="border border-dashed rounded-md p-4 text-center text-sm text-muted-foreground">
                  No positions yet — positions are optional but recommended.
                </div>
              )}

              <div className="space-y-3">
                {positions.map((p) => {
                  const currentBracket = rateBrackets?.find(
                    (b) => b.id === p.rate_bracket_id
                  );
                  return (
                    <div
                      key={p._key}
                      className="rounded-md border p-3 space-y-3 bg-muted/20"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-5">
                          <Label className="text-xs">Position</Label>
                          <Select
                            value={
                              p._isNewBracket
                                ? NEW_BRACKET_VALUE
                                : p.rate_bracket_id || ""
                            }
                            onValueChange={(v) =>
                              handleBracketSelect(p._key, v)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose position…" />
                            </SelectTrigger>
                            <SelectContent>
                              {(rateBrackets || []).map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.name}
                                </SelectItem>
                              ))}
                              <SelectItem value={NEW_BRACKET_VALUE}>
                                + New position…
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {p._isNewBracket && (
                            <Input
                              className="mt-2"
                              placeholder="New position name (required)"
                              value={p._newBracketName || ""}
                              onChange={(e) =>
                                updatePos(p._key, {
                                  _newBracketName: e.target.value,
                                  position_label: e.target.value,
                                })
                              }
                            />
                          )}
                          {currentBracket &&
                            currentBracket.default_pay_rate == null && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                No default pay saved for this bracket — the
                                rate you enter will be saved as its default.
                              </p>
                            )}
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Headcount</Label>
                          <Input
                            type="number"
                            min={1}
                            value={p.headcount}
                            onChange={(e) =>
                              updatePos(p._key, {
                                headcount: parseInt(e.target.value, 10) || 1,
                              })
                            }
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <Label className="text-xs">Pay Rate ($/hr)</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={
                              p.advertised_pay_rate == null
                                ? ""
                                : String(p.advertised_pay_rate)
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              updatePos(p._key, {
                                advertised_pay_rate:
                                  v === "" ? null : parseFloat(v),
                              });
                            }}
                            placeholder="—"
                          />
                        </div>
                        <div className="sm:col-span-2 flex flex-col justify-between">
                          <Label className="text-xs">Show Pay</Label>
                          <div className="flex items-center justify-between h-10">
                            <Switch
                              checked={p.show_pay_publicly}
                              onCheckedChange={(v) =>
                                updatePos(p._key, { show_pay_publicly: v })
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => removePositionRow(p._key)}
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Notes</Label>
                        <Input
                          value={p.notes || ""}
                          onChange={(e) =>
                            updatePos(p._key, { notes: e.target.value })
                          }
                          placeholder="Optional notes visible to admin only"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {positions.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  Task order headcount will be set to {totalHeadcount}
                </Badge>
              )}
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
