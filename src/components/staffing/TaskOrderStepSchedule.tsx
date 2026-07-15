import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface ScheduleValue {
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

interface Props {
  value: ScheduleValue;
  onChange: (patch: Partial<ScheduleValue>) => void;
}

export function TaskOrderStepSchedule({ value, onChange }: Props) {
  return (
    <div className="space-y-5">
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
