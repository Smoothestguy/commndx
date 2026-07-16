import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface ScheduleValue {
  workSummary: string;
  daysPerWeek: string;
  hoursPerDay: string;
  scheduleNotes: string;
  perDiemAmount: string;
  perDiemNotes: string;
  lodgingStatus: string;
  lodgingNotes: string;
  mealsProvided: string;
  mealsNotes: string;
  mobDemobPaid: string;
  mobDemobNotes: string;
}

export const emptySchedule: ScheduleValue = {
  workSummary: "",
  daysPerWeek: "",
  hoursPerDay: "",
  scheduleNotes: "",
  perDiemAmount: "",
  perDiemNotes: "",
  lodgingStatus: "",
  lodgingNotes: "",
  mealsProvided: "",
  mealsNotes: "",
  mobDemobPaid: "",
  mobDemobNotes: "",
};

export const WORK_SUMMARY_TEMPLATES: { label: string; text: string }[] = [
  {
    label: "General labor",
    text: "moving materials, site cleanup, and loading/unloading",
  },
  {
    label: "Storm debris removal",
    text: "cutting, hauling, and loading storm debris",
  },
  {
    label: "Base camp operations",
    text: "setup, housekeeping, and support services at a base camp",
  },
  {
    label: "Demo & repairs",
    text: "tear-out, hauling, and general construction support",
  },
];

interface Props {
  value: ScheduleValue;
  onChange: (patch: Partial<ScheduleValue>) => void;
  workSummaryRequired?: boolean;
  workSummaryError?: string | null;
}

export function TaskOrderStepSchedule({
  value,
  onChange,
  workSummaryRequired = false,
  workSummaryError = null,
}: Props) {
  return (
    <div className="space-y-5">
      <div>
        <Label>
          What will they be doing?{workSummaryRequired && <span className="text-destructive"> *</span>}
        </Label>
        <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
          {WORK_SUMMARY_TEMPLATES.map((t) => (
            <Button
              key={t.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange({ workSummary: t.text })}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <Textarea
          value={value.workSummary}
          onChange={(e) => onChange({ workSummary: e.target.value })}
          placeholder="e.g. Loading and hauling storm debris, operating hand tools, site cleanup…"
          rows={3}
          aria-invalid={!!workSummaryError}
          className={workSummaryError ? "border-destructive" : ""}
        />
        {workSummaryError && (
          <p className="text-xs text-destructive mt-1">{workSummaryError}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Applicants read this first — describe the actual work in one sentence.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Days per Week</Label>
          <Input
            type="number"
            min={1}
            max={7}
            value={value.daysPerWeek}
            onChange={(e) => onChange({ daysPerWeek: e.target.value })}
            placeholder="e.g., 5"
          />
        </div>
        <div>
          <Label>Hours per Day</Label>
          <Input
            type="number"
            min={0}
            step="0.25"
            value={value.hoursPerDay}
            onChange={(e) => onChange({ hoursPerDay: e.target.value })}
            placeholder="e.g., 10"
          />
        </div>
      </div>
      <div>
        <Label>Schedule Notes</Label>
        <Textarea
          value={value.scheduleNotes}
          onChange={(e) => onChange({ scheduleNotes: e.target.value })}
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
            value={value.perDiemAmount}
            onChange={(e) => onChange({ perDiemAmount: e.target.value })}
            placeholder="e.g., 60"
          />
        </div>
        <div>
          <Label>Per Diem Notes</Label>
          <Input
            value={value.perDiemNotes}
            onChange={(e) => onChange({ perDiemNotes: e.target.value })}
            placeholder="Paid daily, receipts required, etc."
          />
        </div>
      </div>

      <div>
        <Label>Lodging</Label>
        <RadioGroup
          value={value.lodgingStatus || "none"}
          onValueChange={(v) => onChange({ lodgingStatus: v === "none" ? "" : v })}
          className="flex flex-wrap gap-4 pt-1"
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="none" /> Unspecified
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="provided" /> Provided
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="stipend" /> Stipend
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="not_provided" /> Not provided
          </label>
        </RadioGroup>
        <Input
          className="mt-2"
          value={value.lodgingNotes}
          onChange={(e) => onChange({ lodgingNotes: e.target.value })}
          placeholder="Lodging notes"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Meals Provided</Label>
          <RadioGroup
            value={value.mealsProvided || "unset"}
            onValueChange={(v) => onChange({ mealsProvided: v === "unset" ? "" : v })}
            className="flex gap-4 pt-1"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="unset" /> Unspecified
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="yes" /> Yes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="no" /> No
            </label>
          </RadioGroup>
          <Input
            className="mt-2"
            value={value.mealsNotes}
            onChange={(e) => onChange({ mealsNotes: e.target.value })}
            placeholder="Meals notes"
          />
        </div>
        <div>
          <Label>Mob/Demob Time Paid</Label>
          <RadioGroup
            value={value.mobDemobPaid || "unset"}
            onValueChange={(v) => onChange({ mobDemobPaid: v === "unset" ? "" : v })}
            className="flex gap-4 pt-1"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="unset" /> Unspecified
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="yes" /> Yes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="no" /> No
            </label>
          </RadioGroup>
          <Input
            className="mt-2"
            value={value.mobDemobNotes}
            onChange={(e) => onChange({ mobDemobNotes: e.target.value })}
            placeholder="Mob/demob notes"
          />
        </div>
      </div>
    </div>
  );
}
