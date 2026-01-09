import { Checkbox } from "@/components/ui/checkbox";
import { IndeterminateCheckbox } from "@/components/ui/indeterminate-checkbox";
import { Button } from "@/components/ui/button";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";
import { Plus, Users } from "lucide-react";

interface PersonnelItem {
  id: string;
  first_name: string;
  last_name: string;
  hourly_rate?: number;
  photo_url?: string;
}

interface WeeklyPersonnelGridProps {
  weeklyProjectId: string | undefined;
  assignedPersonnel: Array<{ personnel: PersonnelItem | null }>;
  selectedPersonnel: Set<string>;
  selectAllPersonnel: () => void;
  clearPersonnelSelection: () => void;
  togglePersonnel: (id: string) => void;
  setQuickAddOpen: (open: boolean) => void;
  setAssignExistingOpen: (open: boolean) => void;
}

export function WeeklyPersonnelGrid({
  weeklyProjectId,
  assignedPersonnel,
  selectedPersonnel,
  selectAllPersonnel,
  clearPersonnelSelection,
  togglePersonnel,
  setQuickAddOpen,
  setAssignExistingOpen,
}: WeeklyPersonnelGridProps) {
  const allSelected = assignedPersonnel.length > 0 && 
    assignedPersonnel.every(a => a.personnel && selectedPersonnel.has(a.personnel.id));
  const someSelected = selectedPersonnel.size > 0 && !allSelected;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IndeterminateCheckbox
            checked={allSelected}
            indeterminate={someSelected}
            onCheckedChange={(checked) => {
              if (checked) selectAllPersonnel();
              else clearPersonnelSelection();
            }}
          />
          <span className="text-sm font-medium">Select Personnel</span>
        </div>
        {weeklyProjectId && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setQuickAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Quick Add
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAssignExistingOpen(true)}>
              <Users className="h-4 w-4 mr-1" /> Assign
            </Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-32 overflow-y-auto border rounded-lg p-2">
        {assignedPersonnel
          .filter((a): a is { personnel: NonNullable<typeof a.personnel> } => a.personnel !== null)
          .map((assignment) => {
            const person = assignment.personnel;
            const isSelected = selectedPersonnel.has(person.id);
            return (
              <button
                type="button"
                key={person.id}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-left w-full ${
                  isSelected ? 'bg-primary/10 border-primary border' : 'bg-muted/50 hover:bg-muted border border-transparent'
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  togglePersonnel(person.id);
                }}
              >
                <Checkbox 
                  checked={isSelected} 
                  onCheckedChange={() => togglePersonnel(person.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <PersonnelAvatar
                  photoUrl={person.photo_url}
                  firstName={person.first_name}
                  lastName={person.last_name}
                  size="xs"
                />
                <span className="text-xs truncate">{person.first_name} {person.last_name}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
