import { Input } from "@/components/ui/input";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";
import { format } from "date-fns";

interface PersonnelItem {
  id: string;
  first_name: string;
  last_name: string;
  hourly_rate?: number;
  photo_url?: string;
}

interface WeekDay {
  date: Date;
  dayName: string;
  dateKey: string;
}

interface PersonnelTotals {
  regular: number;
  overtime: number;
  total: number;
}

interface GrandTotals {
  regular: number;
  overtime: number;
  total: number;
}

interface PersonnelHoursTableProps {
  selectedPersonnel: Set<string>;
  assignedPersonnel: Array<{ personnel: PersonnelItem | null }>;
  weekDays: WeekDay[];
  personnelHours: Record<string, number>;
  updatePersonnelHour: (personnelId: string, dateKey: string, value: number) => void;
  getPersonnelTotals: (personnelId: string) => PersonnelTotals;
  grandTotals: GrandTotals;
}

export function PersonnelHoursTable({
  selectedPersonnel,
  assignedPersonnel,
  weekDays,
  personnelHours,
  updatePersonnelHour,
  getPersonnelTotals,
  grandTotals,
}: PersonnelHoursTableProps) {
  if (selectedPersonnel.size === 0) return null;

  const selectedList = assignedPersonnel.filter(
    a => a.personnel && selectedPersonnel.has(a.personnel.id)
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 min-w-[140px]">Personnel</th>
              {weekDays.map((day) => (
                <th key={day.dateKey} className="text-center p-2 min-w-[60px]">
                  <div className="text-xs">{day.dayName}</div>
                  <div className="text-xs text-muted-foreground">{format(day.date, 'M/d')}</div>
                </th>
              ))}
              <th className="text-center p-2 min-w-[50px]">Reg</th>
              <th className="text-center p-2 min-w-[50px]">OT</th>
              <th className="text-center p-2 min-w-[50px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {selectedList
              .filter((a): a is { personnel: NonNullable<typeof a.personnel> } => a.personnel !== null)
              .map((assignment) => {
                const person = assignment.personnel;
                const totals = getPersonnelTotals(person.id);
                return (
                  <tr key={person.id} className="border-t">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <PersonnelAvatar
                          photoUrl={person.photo_url}
                          firstName={person.first_name}
                          lastName={person.last_name}
                          size="xs"
                        />
                        <span className="truncate text-xs">{person.first_name} {person.last_name}</span>
                      </div>
                    </td>
                    {weekDays.map((day) => {
                      const key = `${person.id}_${day.dateKey}`;
                      return (
                        <td key={day.dateKey} className="p-1">
                          <Input
                            type="number"
                            min="0"
                            max="24"
                            step="0.25"
                            value={personnelHours[key] || ''}
                            onChange={(e) => updatePersonnelHour(person.id, day.dateKey, parseFloat(e.target.value) || 0)}
                            className="h-8 text-center text-sm px-1"
                            placeholder="0"
                          />
                        </td>
                      );
                    })}
                    <td className="p-2 text-center text-xs">{totals.regular.toFixed(1)}</td>
                    <td className="p-2 text-center text-xs text-orange-600">{totals.overtime.toFixed(1)}</td>
                    <td className="p-2 text-center text-xs font-medium">{totals.total.toFixed(1)}</td>
                  </tr>
                );
              })}
          </tbody>
          <tfoot className="bg-muted/30 border-t">
            <tr>
              <td className="p-2 font-medium">Totals</td>
              {weekDays.map((day) => (
                <td key={day.dateKey} className="p-2 text-center text-xs text-muted-foreground">
                  {Object.entries(personnelHours)
                    .filter(([k]) => k.endsWith(`_${day.dateKey}`))
                    .reduce((sum, [, v]) => sum + v, 0)
                    .toFixed(1)}
                </td>
              ))}
              <td className="p-2 text-center text-xs font-medium">{grandTotals.regular.toFixed(1)}</td>
              <td className="p-2 text-center text-xs font-medium text-orange-600">{grandTotals.overtime.toFixed(1)}</td>
              <td className="p-2 text-center text-xs font-bold">{grandTotals.total.toFixed(1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
