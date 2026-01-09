import { Label } from "@/components/ui/label";
import { IndeterminateCheckbox } from "@/components/ui/indeterminate-checkbox";
import { Button } from "@/components/ui/button";
import { PersonnelAvatar } from "@/components/personnel/PersonnelAvatar";
import { Plus, Users, Check } from "lucide-react";

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
                role="button"
                tabIndex={0}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-left w-full ${
                  isSelected ? 'bg-primary/10 border-primary border' : 'bg-muted/50 hover:bg-muted border border-transparent'
                }`}
                onClick={() => togglePersonnel(person.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    togglePersonnel(person.id);
                  }
                }}
              >
                {/* Native styled checkbox - no Radix */}
                <div className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background'
                }`}>
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
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
