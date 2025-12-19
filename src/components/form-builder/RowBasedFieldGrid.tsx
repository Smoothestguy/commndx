import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { FormField, FormRow } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { SortableRow } from "./SortableRow";
import { SortableGridField } from "./SortableGridField";
import { FileText } from "lucide-react";

interface RowBasedFieldGridProps {
  fields: FormField[];
  layout: FormRow[];
  onLayoutChange: (layout: FormRow[]) => void;
  onFieldUpdate: (fieldId: string, updates: Partial<FormField>) => void;
  onFieldRemove: (fieldId: string) => void;
  onUpdateOption: (fieldId: string, optionIndex: number, value: string) => void;
  onAddOption: (fieldId: string) => void;
  onRemoveOption: (fieldId: string, optionIndex: number) => void;
  fieldTypes: readonly { value: string; label: string; icon: any }[];
}

export function RowBasedFieldGrid({
  fields,
  layout,
  onLayoutChange,
  onFieldUpdate,
  onFieldRemove,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
  fieldTypes,
}: RowBasedFieldGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overRowId, setOverRowId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getFieldById = (id: string) => fields.find(f => f.id === id);

  const findFieldLocation = (fieldId: string): { rowIndex: number; fieldIndex: number } | null => {
    for (let rowIndex = 0; rowIndex < layout.length; rowIndex++) {
      const fieldIndex = layout[rowIndex].fieldIds.indexOf(fieldId);
      if (fieldIndex !== -1) {
        return { rowIndex, fieldIndex };
      }
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverRowId(null);
      setOverIndex(null);
      return;
    }

    const overId = over.id as string;
    
    // Check if over a row
    if (overId.startsWith("row-")) {
      setOverRowId(overId.replace("row-", ""));
      setOverIndex(null);
    } else {
      // Over a field - find its row
      const location = findFieldLocation(overId);
      if (location) {
        setOverRowId(layout[location.rowIndex].id);
        setOverIndex(location.fieldIndex);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverRowId(null);
    setOverIndex(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const sourceLocation = findFieldLocation(activeId);
    if (!sourceLocation) return;

    let targetRowIndex: number;
    let targetFieldIndex: number;

    if (overId.startsWith("row-")) {
      // Dropped on a row - append to end
      targetRowIndex = layout.findIndex(r => r.id === overId.replace("row-", ""));
      if (targetRowIndex === -1) return;
      targetFieldIndex = layout[targetRowIndex].fieldIds.length;
    } else {
      // Dropped on a field
      const targetLocation = findFieldLocation(overId);
      if (!targetLocation) return;
      targetRowIndex = targetLocation.rowIndex;
      targetFieldIndex = targetLocation.fieldIndex;
    }

    const newLayout = [...layout.map(row => ({ ...row, fieldIds: [...row.fieldIds] }))];
    
    // Remove from source
    newLayout[sourceLocation.rowIndex].fieldIds.splice(sourceLocation.fieldIndex, 1);

    // If moving within same row but after removal, adjust index
    if (sourceLocation.rowIndex === targetRowIndex && sourceLocation.fieldIndex < targetFieldIndex) {
      targetFieldIndex--;
    }

    // Check if target row will have more than 3 fields
    if (newLayout[targetRowIndex].fieldIds.length >= 3) {
      // Push the last field to a new row
      const overflow = newLayout[targetRowIndex].fieldIds.pop()!;
      
      // Insert active field at target position
      newLayout[targetRowIndex].fieldIds.splice(targetFieldIndex, 0, activeId);
      
      // Create new row for overflow
      const newRow: FormRow = {
        id: `row_${Date.now()}`,
        fieldIds: [overflow],
      };
      newLayout.splice(targetRowIndex + 1, 0, newRow);
    } else {
      // Insert at target position
      newLayout[targetRowIndex].fieldIds.splice(targetFieldIndex, 0, activeId);
    }

    // Clean up empty rows
    const cleanedLayout = newLayout.filter(row => row.fieldIds.length > 0);
    
    onLayoutChange(cleanedLayout);
  };

  const handleRemoveField = (fieldId: string) => {
    // Remove from layout
    const newLayout = layout
      .map(row => ({
        ...row,
        fieldIds: row.fieldIds.filter(id => id !== fieldId),
      }))
      .filter(row => row.fieldIds.length > 0);
    
    onLayoutChange(newLayout);
    onFieldRemove(fieldId);
  };

  // Get all field IDs for SortableContext
  const allFieldIds = layout.flatMap(row => row.fieldIds);

  if (layout.length === 0 || allFieldIds.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No custom fields yet</p>
        <p className="text-sm">Add fields from the sidebar to get started</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={allFieldIds} strategy={rectSortingStrategy}>
        <div className="space-y-2">
          {layout.map((row, rowIndex) => (
            <SortableRow
              key={row.id}
              row={row}
              rowIndex={rowIndex}
              fields={fields}
              isOver={overRowId === row.id}
              overIndex={overRowId === row.id ? overIndex : null}
              activeId={activeId}
              onFieldUpdate={onFieldUpdate}
              onFieldRemove={handleRemoveField}
              onUpdateOption={onUpdateOption}
              onAddOption={onAddOption}
              onRemoveOption={onRemoveOption}
              fieldTypes={fieldTypes}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeId ? (
          <div className="opacity-80">
            <SortableGridField
              field={getFieldById(activeId)!}
              allFields={fields}
              onUpdate={() => {}}
              onRemove={() => {}}
              onUpdateOption={() => {}}
              onAddOption={() => {}}
              onRemoveOption={() => {}}
              fieldTypes={fieldTypes}
              isDragOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
