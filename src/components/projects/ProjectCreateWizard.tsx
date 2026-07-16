import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Copy,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import QRCode from "qrcode";
import { useAddProject } from "@/integrations/supabase/hooks/useProjects";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useApplicationFormTemplates } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import {
  useProjectRateBrackets,
  useAddRateBracket,
  useUpdateRateBracket,
} from "@/integrations/supabase/hooks/useProjectRateBrackets";
import {
  useCreateTaskOrder,
  useCreateJobPosting,
  useReplaceTaskOrderPositions,
} from "@/integrations/supabase/hooks/useStaffingApplications";
import {
  TaskOrderStepSchedule,
  ScheduleValue,
  emptySchedule,
} from "@/components/staffing/TaskOrderStepSchedule";
import {
  TaskOrderStepPositions,
  PositionDraft,
} from "@/components/staffing/TaskOrderStepPositions";
import { buildTaskOrderDescription } from "@/lib/taskOrderDescription";
import { PostingPreviewSection } from "@/components/staffing/PostingPreviewSection";
import { resolvePositionDrafts } from "@/lib/resolvePositions";
import type { ProjectStage } from "@/integrations/supabase/hooks/useProjects";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onProjectCreated?: (projectId: string) => void;
}

interface Basics {
  name: string;
  customer_id: string;
  status: "active" | "completed" | "on-hold";
  stage: ProjectStage;
  start_date: string;
  end_date: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  customer_po: string;
  poc_name: string;
  poc_phone: string;
  poc_email: string;
  use_customer_address: boolean;
  time_clock_enabled: boolean;
  require_clock_location: boolean;
  mandatory_payroll: boolean;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const initialBasics: Basics = {
  name: "",
  customer_id: "",
  status: "active",
  stage: "quote",
  start_date: today(),
  end_date: "",
  description: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  customer_po: "",
  poc_name: "",
  poc_phone: "",
  poc_email: "",
  use_customer_address: false,
  time_clock_enabled: false,
  require_clock_location: true,
  mandatory_payroll: false,
};

type FailedStage = "task_order" | "positions" | "job_posting" | null;

export function ProjectCreateWizard({ open, onOpenChange, onProjectCreated }: Props) {
  const [step, setStep] = useState(1);
  const [basics, setBasics] = useState<Basics>(initialBasics);
  const [hiring, setHiring] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleValue>(emptySchedule);
  const [approxDuration, setApproxDuration] = useState("");
  const [positions, setPositions] = useState<PositionDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Result / retry state
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [createdTaskOrderId, setCreatedTaskOrderId] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [failedStage, setFailedStage] = useState<FailedStage>(null);
  const [failedError, setFailedError] = useState<string>("");
  const [successOpen, setSuccessOpen] = useState(false);

  const { data: customers } = useCustomers();
  const { data: formTemplates } = useApplicationFormTemplates();
  const { data: companySettings } = useCompanySettings();
  const { data: rateBrackets } = useProjectRateBrackets(createdProjectId || undefined);

  const addProject = useAddProject();
  const createTaskOrder = useCreateTaskOrder();
  const createJobPosting = useCreateJobPosting();
  const replacePositions = useReplaceTaskOrderPositions();
  const addRateBracket = useAddRateBracket();
  const updateRateBracket = useUpdateRateBracket();

  const selectedCustomer = customers?.find((c) => c.id === basics.customer_id);

  useEffect(() => {
    if (basics.use_customer_address && selectedCustomer) {
      const c = selectedCustomer as any;
      setBasics((b) => ({
        ...b,
        address: c.address || "",
        city: c.city || "",
        state: c.state || "",
        zip: c.zip || "",
      }));
    }
  }, [basics.use_customer_address, selectedCustomer]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setBasics(initialBasics);
    setHiring(true);
    setSchedule(emptySchedule);
    setApproxDuration("");
    setPositions([]);
    setCreatedProjectId(null);
    setCreatedTaskOrderId(null);
    setPublicUrl("");
    setQrDataUrl("");
    setFailedStage(null);
    setFailedError("");
    setSuccessOpen(false);
  }, [open]);

  const composedLocation = useMemo(() => {
    const line = [basics.address, basics.city, basics.state, basics.zip]
      .filter(Boolean)
      .join(", ");
    return line;
  }, [basics.address, basics.city, basics.state, basics.zip]);

  const defaultTemplateId = useMemo(() => {
    const preferred = (companySettings as any)?.default_form_template_id as
      | string
      | null
      | undefined;
    const active = (formTemplates ?? []).filter((t) => t.is_active);
    if (preferred && active.some((t) => t.id === preferred)) return preferred;
    const frg = active.find((t) =>
      t.name.toLowerCase().startsWith("frg standard")
    );
    return frg?.id || undefined;
  }, [companySettings, formTemplates]);

  const totalSteps = hiring ? 4 : 2;
  const canNext = () => {
    if (step === 1) {
      return !!basics.name.trim() && !!basics.customer_id && !!basics.start_date;
    }
    return true;
  };

  const buildProjectPayload = () => {
    const { use_customer_address, ...rest } = basics;
    return {
      ...rest,
      end_date: basics.end_date || null,
      description: basics.description || null,
      address: basics.address || null,
      city: basics.city || null,
      state: basics.state || null,
      zip: basics.zip || null,
      customer_po: basics.customer_po || null,
      poc_name: basics.poc_name || null,
      poc_phone: basics.poc_phone || null,
      poc_email: basics.poc_email || null,
    };
  };

  const runStaffingChain = async (projectId: string) => {
    // 1) create task order
    let taskOrderId = createdTaskOrderId;
    if (!taskOrderId) {
      try {
        const startAt = basics.start_date
          ? new Date(basics.start_date + "T08:00:00").toISOString()
          : null;
        const jobDescription = buildTaskOrderDescription({
          title: basics.name,
          locationAddress: composedLocation,
          startAt,
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
        });
        const daysNum =
          schedule.daysPerWeek === "" ? null : parseInt(schedule.daysPerWeek, 10);
        const hoursNum =
          schedule.hoursPerDay === "" ? null : parseFloat(schedule.hoursPerDay);
        const perDiemNum =
          schedule.perDiemAmount === "" ? null : parseFloat(schedule.perDiemAmount);
        const created = await createTaskOrder.mutateAsync({
          project_id: projectId,
          status: "open",
          headcount_needed: Math.max(
            1,
            positions.reduce((s, p) => s + (Number(p.headcount) || 0), 0)
          ),
          title: basics.name,
          job_description: jobDescription,
          location_address: composedLocation || null,
          start_at: startAt,
          approx_duration: approxDuration.trim() || null,
          days_per_week: daysNum != null && !isNaN(daysNum) ? daysNum : null,
          hours_per_day: hoursNum != null && !isNaN(hoursNum) ? hoursNum : null,
          schedule_notes: schedule.scheduleNotes.trim() || null,
          per_diem_amount:
            perDiemNum != null && !isNaN(perDiemNum) ? perDiemNum : null,
          per_diem_notes: schedule.perDiemNotes.trim() || null,
          lodging_status: (schedule.lodgingStatus || null) as any,
          lodging_notes: schedule.lodgingNotes.trim() || null,
          meals_provided:
            schedule.mealsProvided === ""
              ? null
              : schedule.mealsProvided === "yes",
          meals_notes: schedule.mealsNotes.trim() || null,
          mob_demob_paid:
            schedule.mobDemobPaid === ""
              ? null
              : schedule.mobDemobPaid === "yes",
          mob_demob_notes: schedule.mobDemobNotes.trim() || null,
          location_lat: null,
          location_lng: null,
        } as any);
        taskOrderId = created.id;
        setCreatedTaskOrderId(taskOrderId);
      } catch (e: any) {
        setFailedStage("task_order");
        setFailedError(e?.message || "Failed to create task order");
        return;
      }
    }

    // 2) positions
    if (positions.length > 0) {
      try {
        const resolved = await resolvePositionDrafts({
          projectId,
          positions,
          rateBrackets,
          addRateBracket,
          updateRateBracket,
        });
        await replacePositions.mutateAsync({
          taskOrderId: taskOrderId!,
          positions: resolved,
        });
      } catch (e: any) {
        setFailedStage("positions");
        setFailedError(e?.message || "Failed to save positions");
        return;
      }
    }

    // 3) job posting
    try {
      const posting = await createJobPosting.mutateAsync({
        taskOrderId: taskOrderId!,
        formTemplateId: defaultTemplateId,
      });
      const url = `${window.location.origin}/apply/${posting.public_token}`;
      setPublicUrl(url);
      try {
        const qr = await QRCode.toDataURL(url, { width: 220, margin: 1 });
        setQrDataUrl(qr);
      } catch {
        /* ignore QR failure */
      }
      setFailedStage(null);
      setFailedError("");
      setSuccessOpen(true);
    } catch (e: any) {
      setFailedStage("job_posting");
      setFailedError(e?.message || "Failed to create job posting");
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Save project (or reuse if already created via retry)
      let projectId = createdProjectId;
      if (!projectId) {
        const project = await addProject.mutateAsync(buildProjectPayload() as any);
        projectId = project.id;
        setCreatedProjectId(projectId);
        onProjectCreated?.(projectId);
      }

      if (!hiring) {
        onOpenChange(false);
        return;
      }

      await runStaffingChain(projectId);
    } catch (e: any) {
      // project creation itself failed
      toast.error(e?.message || "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async () => {
    if (!createdProjectId) return;
    setSubmitting(true);
    try {
      await runStaffingChain(createdProjectId);
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Application link copied");
    } catch {
      toast.error("Unable to copy — link is shown above");
    }
  };

  const stepLabels = hiring
    ? ["Project", "Hire?", "Schedule", "Positions"]
    : ["Project", "Hire?"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            {successOpen
              ? "Your project is live."
              : "Fill in the project details, then optionally set up hiring."}
          </DialogDescription>
          {!successOpen && (
            <div className="flex items-center gap-2 pt-2 flex-wrap">
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
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {successOpen ? (
            <div className="space-y-5 py-4">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold">Project created — hiring is live</h3>
                <p className="text-sm text-muted-foreground">
                  Share this link or QR code to accept applications.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="Apply QR code"
                    className="rounded border p-2 bg-background"
                    width={220}
                    height={220}
                  />
                )}
                <div className="w-full flex gap-2">
                  <Input value={publicUrl} readOnly className="font-mono text-xs" />
                  <Button type="button" variant="outline" onClick={copyLink}>
                    <Copy className="h-4 w-4 mr-1" /> Copy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.open(publicUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : failedStage ? (
            <div className="space-y-4 py-4">
              <Card className="border-destructive/40">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <p className="font-medium text-sm">
                      Project saved, but the {failedStage.replace("_", " ")} step failed.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{failedError}</p>
                  <p className="text-xs text-muted-foreground">
                    Your project is safe. You can retry the remaining steps, or close this
                    dialog and open the project.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : step === 1 ? (
            <BasicsForm basics={basics} setBasics={setBasics} customers={customers} />
          ) : step === 2 ? (
            <div className="space-y-4 py-2">
              <Card
                className={`cursor-pointer transition-colors ${
                  hiring ? "border-primary" : ""
                }`}
                onClick={() => setHiring(true)}
              >
                <CardContent className="pt-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">Hire workers for this project</p>
                    <p className="text-sm text-muted-foreground">
                      Creates a task order + public application link. Recommended.
                    </p>
                  </div>
                  <Switch checked={hiring} onCheckedChange={setHiring} />
                </CardContent>
              </Card>
              <Card
                className={`cursor-pointer transition-colors ${
                  !hiring ? "border-primary" : ""
                }`}
                onClick={() => setHiring(false)}
              >
                <CardContent className="pt-4">
                  <p className="font-semibold">Just save the project</p>
                  <p className="text-sm text-muted-foreground">
                    Skip hiring setup. You can add crew later from the project page.
                  </p>
                </CardContent>
              </Card>

              {hiring && (
                <p className="text-xs text-muted-foreground">
                  Location and start date come from Step 1 —{" "}
                  <span className="font-medium">{composedLocation || "no address"}</span>,
                  starting <span className="font-medium">{basics.start_date || "—"}</span>.
                </p>
              )}
            </div>
          ) : step === 3 ? (
            <div className="space-y-4">
              <div>
                <Label>Approx Duration</Label>
                <Input
                  value={approxDuration}
                  onChange={(e) => setApproxDuration(e.target.value)}
                  placeholder="e.g., 2-3 weeks"
                />
              </div>
              <TaskOrderStepSchedule
                value={schedule}
                onChange={(patch) => setSchedule((s) => ({ ...s, ...patch }))}
              />
            </div>
          ) : (
            <TaskOrderStepPositions
              positions={positions}
              onChange={setPositions}
              rateBrackets={rateBrackets}
              projectSelected={true}
            />
          )}
        </div>

        <DialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-2 sm:justify-between">
          {successOpen ? (
            <>
              <div />
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          ) : failedStage ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
                Close
              </Button>
              <Button onClick={handleRetry} disabled={submitting} type="button">
                {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Retry
              </Button>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                {step > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => setStep((s) => s - 1)}
                    type="button"
                    disabled={submitting}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  type="button"
                  disabled={submitting}
                >
                  Cancel
                </Button>
                {step < totalSteps ? (
                  <Button
                    onClick={() => setStep((s) => s + 1)}
                    disabled={!canNext() || submitting}
                    type="button"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={submitting} type="button">
                    {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    {hiring ? "Create project & posting" : "Create project"}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------- Step 1: project basics ------------- */

function BasicsForm({
  basics,
  setBasics,
  customers,
}: {
  basics: Basics;
  setBasics: React.Dispatch<React.SetStateAction<Basics>>;
  customers: any[] | undefined;
}) {
  const set = (patch: Partial<Basics>) => setBasics((b) => ({ ...b, ...patch }));
  return (
    <form
      id="project-wizard-basics"
      className="space-y-6 py-2"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Basic Information</h4>
        <div className="space-y-2">
          <Label htmlFor="pw-name">Project Name *</Label>
          <Input
            id="pw-name"
            value={basics.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Enter project name"
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Customer *</Label>
            <Select
              value={basics.customer_id}
              onValueChange={(v) => set({ customer_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company || c.name}
                    {c.company && c.name && c.company !== c.name && (
                      <span className="text-muted-foreground ml-1">({c.name})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Stage</Label>
            <Select
              value={basics.stage}
              onValueChange={(v: ProjectStage) => set({ stage: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="task_order">Task Order</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Customer PO #</Label>
          <Input
            value={basics.customer_po}
            onChange={(e) => set({ customer_po: e.target.value })}
            placeholder="Customer reference number"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">Project Address</h4>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={basics.use_customer_address}
              onCheckedChange={(v) => set({ use_customer_address: !!v })}
              disabled={!basics.customer_id}
            />
            Same as customer
          </label>
        </div>
        <div className="space-y-2">
          <Label>Street Address</Label>
          <Input
            value={basics.address}
            onChange={(e) => set({ address: e.target.value })}
            disabled={basics.use_customer_address}
            placeholder="123 Main St"
          />
        </div>
        <div className="grid gap-4 grid-cols-6">
          <div className="col-span-3 space-y-2">
            <Label>City</Label>
            <Input
              value={basics.city}
              onChange={(e) => set({ city: e.target.value })}
              disabled={basics.use_customer_address}
            />
          </div>
          <div className="col-span-1 space-y-2">
            <Label>State</Label>
            <Input
              value={basics.state}
              maxLength={2}
              onChange={(e) => set({ state: e.target.value })}
              disabled={basics.use_customer_address}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>ZIP</Label>
            <Input
              value={basics.zip}
              onChange={(e) => set({ zip: e.target.value })}
              disabled={basics.use_customer_address}
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Point of Contact</h4>
        <div className="space-y-2">
          <Label>Contact Name</Label>
          <Input
            value={basics.poc_name}
            onChange={(e) => set({ poc_name: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Contact Phone</Label>
            <Input
              type="tel"
              value={basics.poc_phone}
              onChange={(e) => set({ poc_phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Contact Email</Label>
            <Input
              type="email"
              value={basics.poc_email}
              onChange={(e) => set({ poc_email: e.target.value })}
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Schedule</h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Start Date *</Label>
            <Input
              type="date"
              value={basics.start_date}
              onChange={(e) => set({ start_date: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={basics.end_date}
              onChange={(e) => set({ end_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={basics.status}
              onValueChange={(v: "active" | "completed" | "on-hold") =>
                set({ status: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on-hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">
          Time Clock & Payroll
        </h4>
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Clock In/Out</Label>
            <p className="text-xs text-muted-foreground">
              Personnel can clock in/out from their portal
            </p>
          </div>
          <Switch
            checked={basics.time_clock_enabled}
            onCheckedChange={(v) => set({ time_clock_enabled: v })}
          />
        </div>
        {basics.time_clock_enabled && (
          <div className="flex items-center justify-between">
            <div>
              <Label>Require Location</Label>
              <p className="text-xs text-muted-foreground">
                Location must be captured when clocking in/out
              </p>
            </div>
            <Switch
              checked={basics.require_clock_location}
              onCheckedChange={(v) => set({ require_clock_location: v })}
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <Label>Mandatory Payroll</Label>
            <p className="text-xs text-muted-foreground">
              Personnel must be on payroll for this project
            </p>
          </div>
          <Switch
            checked={basics.mandatory_payroll}
            onCheckedChange={(v) => set({ mandatory_payroll: v })}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Project Scope / Notes</Label>
        <Textarea
          value={basics.description}
          onChange={(e) => set({ description: e.target.value })}
          className="min-h-[100px]"
          placeholder="Enter project description, scope of work, or notes..."
        />
      </div>
    </form>
  );
}
