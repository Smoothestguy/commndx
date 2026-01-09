import { Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TimeDecimalInput } from "@/components/ui/time-decimal-input";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";
import { ApplyToAllControl } from "./ApplyToAllControl";

interface PersonnelItem {
  id: string;
  first_name: string;
  last_name: string;
  hourly_rate?: number;
  photo_url?: string;
}

interface DailyPersonnelHoursSectionProps {
  selectedPersonnelList: Array<{
    personnel: PersonnelItem | null;
  }>;
  dailyPersonnelHours: Record<string, number>;
  updateDailyPersonnelHour: (personnelId: string, value: number) => void;
  applyHoursToAllDaily: (hours: number) => void;
  watchedIsHoliday: boolean;
  holidayMultiplier: number;
  dailyTotalHours: number;
  estimatedDailyCost: number;
  weeklyOvertimeThreshold: number;
}

export function DailyPersonnelHoursSection({
  selectedPersonnelList,
  dailyPersonnelHours,
  updateDailyPersonnelHour,
  applyHoursToAllDaily,
  watchedIsHoliday,
  holidayMultiplier,
  dailyTotalHours,
  estimatedDailyCost,
  weeklyOvertimeThreshold,
}: DailyPersonnelHoursSectionProps) {
  if (selectedPersonnelList.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Hours per Personnel
        </Label>
        <ApplyToAllControl onApply={applyHoursToAllDaily} />
      </div>

      <div className="border rounded-lg divide-y">
        {selectedPersonnelList
          .filter((a): a is { personnel: NonNullable<typeof a.personnel> } => a.personnel !== null)
          .map((assignment) => {
            const person = assignment.personnel;
            const hours = dailyPersonnelHours[person.id] || 0;
            const cost = hours * (person.hourly_rate || 0) * (watchedIsHoliday ? holidayMultiplier : 1);
            
            return (
              <div key={person.id} className="flex items-center justify-between p-3 gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <PersonnelAvatar
                    photoUrl={person.photo_url}
                    firstName={person.first_name}
                    lastName={person.last_name}
                    size="xs"
                  />
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {person.first_name} {person.last_name}
                    </span>
                    {person.hourly_rate && (
                      <span className="text-xs text-muted-foreground">
                        ${person.hourly_rate}/hr
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <TimeDecimalInput
                    value={hours}
                    onValueChange={(value) => updateDailyPersonnelHour(person.id, value)}
                    placeholder="0"
                    compact
                    className="w-20"
                  />
                  {cost > 0 && (
                    <span className="text-sm font-medium text-primary w-20 text-right">
                      ${cost.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Totals */}
      {dailyTotalHours > 0 && (
        <div className="rounded-lg border p-3 bg-muted/30">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Total Hours:
            </span>
            <span className="font-medium">{dailyTotalHours.toFixed(2)}h</span>
          </div>
          {estimatedDailyCost > 0 && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-muted-foreground flex items-center gap-1">
                Estimated Cost:
                {watchedIsHoliday && (
                  <Badge variant="outline" className="text-purple-600 border-purple-300 text-xs">
                    Holiday 2x
                  </Badge>
                )}
              </span>
              <span className="font-medium text-primary">${estimatedDailyCost.toFixed(2)}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Overtime is calculated weekly when total exceeds {weeklyOvertimeThreshold}h
          </p>
        </div>
      )}
    </div>
  );
}
