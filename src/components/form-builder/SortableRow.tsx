import { FormField, FormRow } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { SortableGridField } from "./SortableGridField";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface SortableRowProps {
  row: FormRow;
  rowIndex: number;
  fields: FormField[];
  isOver: boolean;
  overIndex: number | null;
  activeId: string | null;
  onFieldUpdate: (fieldId: string, updates: Partial<FormField>) => void;
  onFieldRemove: (fieldId: string) => void;
  onUpdateOption: (fieldId: string, optionIndex: number, value: string) => void;
  onAddOption: (fieldId: string) => void;
  onRemoveOption: (fieldId: string, optionIndex: number) => void;
  fieldTypes: readonly { value: string; label: string; icon: any }[];
}

export function SortableRow({
  row,
  rowIndex,
  fields,
  isOver,
  overIndex,
  activeId,
  onFieldUpdate,
  onFieldRemove,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
  fieldTypes,
}: SortableRowProps) {
  const { setNodeRef } = useDroppable({
    id: `row-${row.id}`,
  });

  const getFieldById = (id: string) => fields.find(f => f.id === id);
  const fieldCount = row.fieldIds.length;

  // Get grid class based on number of fields in row
  const getGridClass = () => {
    switch (fieldCount) {
      case 1:
        return "grid-cols-1";
      case 2:
        return "grid-cols-2";
      case 3:
        return "grid-cols-3";
      default:
        return "grid-cols-1";
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "grid gap-2 p-1 rounded-lg transition-all duration-200",
        getGridClass(),
        isOver && "bg-primary/5 ring-2 ring-primary/20"
      )}
    >
      {row.fieldIds.map((fieldId, index) => {
        const field = getFieldById(fieldId);
        if (!field) return null;

        const showDropIndicator = isOver && overIndex === index && activeId !== fieldId;

        return (
          <div key={fieldId} className="relative">
            {/* Drop indicator line */}
            {showDropIndicator && (
              <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-primary rounded-full z-10" />
            )}
            <SortableGridField
              field={field}
              allFields={fields}
              onUpdate={(updates) => onFieldUpdate(fieldId, updates)}
              onRemove={() => onFieldRemove(fieldId)}
              onUpdateOption={(optIndex, value) => onUpdateOption(fieldId, optIndex, value)}
              onAddOption={() => onAddOption(fieldId)}
              onRemoveOption={(optIndex) => onRemoveOption(fieldId, optIndex)}
              fieldTypes={fieldTypes}
            />
          </div>
        );
      })}
      
      {/* Drop indicator at end of row */}
      {isOver && overIndex === null && row.fieldIds.length < 3 && (
        <div className="flex items-center justify-center border-2 border-dashed border-primary/40 rounded-lg bg-primary/5 min-h-[60px]">
          <span className="text-xs text-primary/60">Drop here</span>
        </div>
      )}
    </div>
  );
}
