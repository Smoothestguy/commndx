import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, GripVertical, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FormField } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { ConditionalLogicBuilder } from "./ConditionalLogicBuilder";
import { ValidationSettings } from "./ValidationSettings";
import { VisibilitySettings } from "./VisibilitySettings";
import { cn } from "@/lib/utils";

interface SortableGridFieldProps {
  field: FormField;
  allFields: FormField[];
  onUpdate: (updates: Partial<FormField>) => void;
  onRemove: () => void;
  onUpdateOption: (optionIndex: number, value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (optionIndex: number) => void;
  fieldTypes: readonly { value: string; label: string; icon: any }[];
  isDragOverlay?: boolean;
}

export function SortableGridField({
  field,
  allFields,
  onUpdate,
  onRemove,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
  fieldTypes,
  isDragOverlay = false,
}: SortableGridFieldProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, disabled: isDragOverlay });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const hasOptions = field.type === "dropdown" || field.type === "radio" || field.type === "multiselect";
  const hasPlaceholder = ["text", "textarea", "number", "email", "phone", "firstname", "lastname"].includes(field.type);
  const hasLayoutOption = field.type === "multiselect" || field.type === "radio";
  const hasIconOption = field.type === "email" || field.type === "phone";
  const isNonInput = field.type === "section" || field.type === "address";
  const isSection = field.type === "section";

  const getFieldTypeIcon = (type: string) => {
    const fieldType = fieldTypes.find(t => t.value === type);
    return fieldType?.icon;
  };

  const Icon = getFieldTypeIcon(field.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "border rounded-lg bg-card transition-all",
        isExpanded ? "ring-2 ring-primary/20" : "",
        isDragging && "shadow-lg",
        field.defaultVisible === false && "opacity-75 border-dashed"
      )}
    >
      {/* Compact Header */}
      <div className="flex items-center gap-2 p-2">
        <div 
          className="cursor-grab hover:bg-muted rounded p-1 touch-none"
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
          <Input
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder={isNonInput ? "Section title" : "Field label"}
            className="flex-1 h-8 text-sm"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isNonInput && (
            <div className="flex items-center gap-1.5 px-2">
              <Switch
                checked={field.required}
                onCheckedChange={(checked) => onUpdate({ required: checked })}
                className="scale-75"
              />
              <Label className="text-xs text-muted-foreground">Req</Label>
            </div>
          )}
          
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Settings2 className={cn("h-3.5 w-3.5 transition-colors", isExpanded && "text-primary")} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded Settings */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t space-y-3 text-sm">
            <Accordion type="multiple" className="w-full">
              {/* Basic Settings */}
              <AccordionItem value="basic" className="border-none">
                <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                  Basic Settings
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  {/* Field Type Selector */}
                  <div>
                    <Label className="text-xs">Field Type</Label>
                    <Select
                      value={field.type}
                      onValueChange={(value) => onUpdate({ 
                        type: value as FormField["type"],
                        options: ["dropdown", "radio", "multiselect"].includes(value) 
                          ? (field.options?.length ? field.options : ["Option 1", "Option 2"]) 
                          : undefined
                      })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Placeholder / Help Text */}
                  <div className="grid grid-cols-2 gap-2">
                    {hasPlaceholder && (
                      <div>
                        <Label className="text-xs">Placeholder</Label>
                        <Input
                          value={field.placeholder || ""}
                          onChange={(e) => onUpdate({ placeholder: e.target.value })}
                          placeholder="Enter placeholder..."
                          className="h-8"
                        />
                      </div>
                    )}
                    
                    <div className={hasPlaceholder ? "" : "col-span-2"}>
                      <Label className="text-xs">Help Text</Label>
                      <Input
                        value={field.helpText || ""}
                        onChange={(e) => onUpdate({ helpText: e.target.value })}
                        placeholder="Additional instructions..."
                        className="h-8"
                      />
                    </div>
                  </div>

                  {/* Icon toggle for email/phone */}
                  {hasIconOption && (
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={field.showIcon !== false}
                        onCheckedChange={(checked) => onUpdate({ showIcon: checked })}
                      />
                      <Label className="text-xs">Show Input Icon</Label>
                    </div>
                  )}

                  {/* Section description */}
                  {isSection && (
                    <div>
                      <Label className="text-xs">Section Description</Label>
                      <Textarea
                        value={field.sectionDescription || ""}
                        onChange={(e) => onUpdate({ sectionDescription: e.target.value })}
                        placeholder="Description shown below section title..."
                        className="min-h-[60px]"
                      />
                    </div>
                  )}

                  {/* Page break for sections */}
                  {isSection && (
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={field.isPageBreak || false}
                        onCheckedChange={(checked) => onUpdate({ isPageBreak: checked })}
                      />
                      <div>
                        <Label className="text-xs">Page Break</Label>
                        <p className="text-xs text-muted-foreground">
                          Start a new page/step at this section
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Default Value */}
                  {!isNonInput && !hasIconOption && !["checkbox", "file", "signature"].includes(field.type) && (
                    <div>
                      <Label className="text-xs">Default Value</Label>
                      {field.type === "textarea" ? (
                        <Textarea
                          value={field.defaultValue || ""}
                          onChange={(e) => onUpdate({ defaultValue: e.target.value })}
                          placeholder="Pre-filled value..."
                          className="min-h-[60px]"
                        />
                      ) : (
                        <Input
                          value={field.defaultValue || ""}
                          onChange={(e) => onUpdate({ defaultValue: e.target.value })}
                          placeholder="Pre-filled value..."
                          className="h-8"
                        />
                      )}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Options for dropdown/radio/multiselect */}
              {hasOptions && (
                <AccordionItem value="options" className="border-none">
                  <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                    Options
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pt-2">
                    {field.options?.map((option, optIndex) => (
                      <div key={optIndex} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(e) => onUpdateOption(optIndex, e.target.value)}
                          className="h-8"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive shrink-0"
                          onClick={() => onRemoveOption(optIndex)}
                          disabled={(field.options?.length || 0) <= 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onAddOption}
                      className="h-7 text-xs"
                    >
                      + Add Option
                    </Button>

                    {/* Layout option for multiselect/radio */}
                    {hasLayoutOption && (
                      <div className="pt-2 flex items-center gap-3">
                        <Label className="text-xs">Layout:</Label>
                        <Select
                          value={field.optionLayout || "vertical"}
                          onValueChange={(v) => onUpdate({ optionLayout: v as "vertical" | "grid" })}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vertical">Vertical</SelectItem>
                            <SelectItem value="grid">Grid (2-3 cols)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Validation Settings */}
              {!isNonInput && (
                <AccordionItem value="validation" className="border-none">
                  <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                    Validation
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <ValidationSettings field={field} onUpdate={onUpdate} />
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Visibility Settings */}
              <AccordionItem value="visibility" className="border-none">
                <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                  Visibility & Pre-fill
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <VisibilitySettings field={field} onUpdate={onUpdate} />
                </AccordionContent>
              </AccordionItem>

              {/* Conditional Logic */}
              {allFields.length > 1 && (
                <AccordionItem value="conditional" className="border-none">
                  <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                    Conditional Logic
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <ConditionalLogicBuilder
                      field={field}
                      allFields={allFields}
                      onUpdate={(conditionalLogic) => onUpdate({ conditionalLogic })}
                    />
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* File upload settings */}
              {field.type === "file" && (
                <AccordionItem value="file" className="border-none">
                  <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                    File Settings
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Accepted File Types</Label>
                        <Input
                          value={field.acceptedFileTypes?.join(", ") || ""}
                          onChange={(e) => onUpdate({ 
                            acceptedFileTypes: e.target.value.split(",").map(t => t.trim()).filter(Boolean)
                          })}
                          placeholder=".pdf, .doc, .docx"
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Max File Size (MB)</Label>
                        <Input
                          type="number"
                          value={field.maxFileSize || 5}
                          onChange={(e) => onUpdate({ maxFileSize: parseInt(e.target.value) || 5 })}
                          className="h-8"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
