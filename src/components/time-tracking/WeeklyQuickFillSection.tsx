import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface WeekDay {
  date: Date;
  dayName: string;
  dateKey: string;
}

interface WeeklyQuickFillSectionProps {
  selectedPersonnelSize: number;
  weekDays: WeekDay[];
  templateHours: Record<string, number>;
  updateTemplateHour: (dateKey: string, value: number) => void;
  applyTemplateToAll: () => void;
}

export function WeeklyQuickFillSection({
  selectedPersonnelSize,
  weekDays,
  templateHours,
  updateTemplateHour,
  applyTemplateToAll,
}: WeeklyQuickFillSectionProps) {
  if (selectedPersonnelSize === 0) return null;

  return (
    <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Quick Fill Template</Label>
        <Button type="button" variant="secondary" size="sm" onClick={applyTemplateToAll}>
          Apply to All Selected ({selectedPersonnelSize})
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div key={day.dateKey} className="text-center">
            <div className="text-xs text-muted-foreground mb-1">{day.dayName}</div>
            <div className="text-xs text-muted-foreground mb-1">{format(day.date, 'M/d')}</div>
            <Input
              type="number"
              min="0"
              max="24"
              step="0.25"
              value={templateHours[day.dateKey] || ''}
              onChange={(e) => updateTemplateHour(day.dateKey, parseFloat(e.target.value) || 0)}
              className="h-8 text-center text-sm px-1"
              placeholder="0"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
