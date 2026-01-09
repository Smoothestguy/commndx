import { Label } from "@/components/ui/label";
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

interface PersonnelSelectionSectionProps {
  assignedPersonnel: Array<{ personnel: PersonnelItem | null }>;
  selectedPersonnel: Set<string>;
  togglePersonnel: (id: string) => void;
  selectAllPersonnel: () => void;
  clearPersonnelSelection: () => void;
  showProjectActions: boolean;
  onQuickAddOpen: () => void;
  onAssignExistingOpen: () => void;
}

export function PersonnelSelectionSection({
  assignedPersonnel,
  selectedPersonnel,
  togglePersonnel,
  selectAllPersonnel,
  clearPersonnelSelection,
  showProjectActions,
  onQuickAddOpen,
  onAssignExistingOpen,
}: PersonnelSelectionSectionProps) {
  const allSelected = assignedPersonnel.length > 0 && 
    assignedPersonnel.every(a => a.personnel && selectedPersonnel.has(a.personnel.id));
  const someSelected = selectedPersonnel.size > 0 && !allSelected;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Personnel
        </Label>
        <div className="flex items-center gap-2">
          <IndeterminateCheckbox
            id="select-all-personnel"
            checked={allSelected}
            indeterminate={someSelected}
            onCheckedChange={(checked) => {
              if (checked) selectAllPersonnel();
              else clearPersonnelSelection();
            }}
          />
          <label htmlFor="select-all-personnel" className="text-xs text-muted-foreground cursor-pointer">
            Select All
          </label>
        </div>
      </div>

      {showProjectActions && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onQuickAddOpen}>
            <Plus className="h-4 w-4 mr-1" /> Quick Add
          </Button>
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onAssignExistingOpen}>
            <Users className="h-4 w-4 mr-1" /> Assign Existing
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-lg p-2">
        {assignedPersonnel
          .filter((a): a is { personnel: NonNullable<typeof a.personnel> } => a.personnel !== null)
          .map((assignment) => {
            const person = assignment.personnel;
            const isSelected = selectedPersonnel.has(person.id);
            return (
              <div
                key={person.id}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected ? 'bg-primary/10 border-primary border' : 'bg-muted/50 hover:bg-muted'
                }`}
                onClick={() => togglePersonnel(person.id)}
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
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium truncate block">
                    {person.first_name} {person.last_name}
                  </span>
                  {person.hourly_rate && (
                    <span className="text-xs text-muted-foreground">
                      ${person.hourly_rate}/hr
                    </span>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
