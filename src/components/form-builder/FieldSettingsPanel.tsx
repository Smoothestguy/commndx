import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2, GripVertical, Settings2 } from "lucide-react";
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
import { FormField } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { ConditionalLogicBuilder } from "./ConditionalLogicBuilder";
import { cn } from "@/lib/utils";

interface FieldSettingsPanelProps {
  field: FormField;
  index: number;
  allFields: FormField[];
  onUpdate: (updates: Partial<FormField>) => void;
  onRemove: () => void;
  onUpdateOption: (optionIndex: number, value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (optionIndex: number) => void;
  fieldTypes: readonly { value: string; label: string; icon: any }[];
  dragHandleProps?: Record<string, any>;
}

export function FieldSettingsPanel({
  field,
  index,
  allFields,
  onUpdate,
  onRemove,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
  fieldTypes,
  dragHandleProps,
}: FieldSettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasOptions = field.type === "dropdown" || field.type === "radio" || field.type === "multiselect";
  const hasPlaceholder = ["text", "textarea", "number", "email", "phone", "firstname", "lastname"].includes(field.type);
  const hasLayoutOption = field.type === "multiselect" || field.type === "radio";
  const hasIconOption = field.type === "email" || field.type === "phone";
  // Only section type cannot be required - address fields can be required
  const isNonInput = field.type === "section";

  const getFieldTypeLabel = (type: string) => {
    return fieldTypes.find(t => t.value === type)?.label || type;
  };

  return (
    <div className={cn(
      "border rounded-lg bg-card transition-all",
      isExpanded ? "ring-2 ring-primary/20" : ""
    )}>
      {/* Header - Always visible */}
      <div className="flex items-center gap-2 p-3">
        <div 
          className="cursor-grab hover:bg-muted rounded p-1 touch-none"
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder={isNonInput ? "Section title" : "Field label"}
            className="flex-1 h-9"
          />
          <Select
            value={field.type}
            onValueChange={(value) => onUpdate({ 
              type: value as FormField["type"],
              options: ["dropdown", "radio", "multiselect"].includes(value) 
                ? (field.options?.length ? field.options : ["Option 1", "Option 2"]) 
                : undefined
            })}
          >
            <SelectTrigger className="w-[140px] h-9">
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

        <div className="flex items-center gap-1">
          {!isNonInput && (
            <div className="flex items-center gap-2 px-2">
              <Switch
                checked={field.required}
                onCheckedChange={(checked) => onUpdate({ required: checked })}
                className="scale-90"
              />
              <Label className="text-xs text-muted-foreground">Required</Label>
            </div>
          )}
          
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings2 className={cn("h-4 w-4 transition-colors", isExpanded && "text-primary")} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Settings */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t space-y-4">
            {/* Placeholder / Help Text */}
            <div className="grid grid-cols-2 gap-3">
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

            {/* Options for dropdown/radio/multiselect */}
            {hasOptions && (
              <div className="space-y-2">
                <Label className="text-xs">Options</Label>
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
                  className="h-8"
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
              </div>
            )}

            {/* File upload settings */}
            {field.type === "file" && (
              <div className="grid grid-cols-2 gap-3">
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
            )}

            {/* Conditional Logic */}
            {!isNonInput && allFields.length > 1 && (
              <ConditionalLogicBuilder
                field={field}
                allFields={allFields}
                onUpdate={(conditionalLogic) => onUpdate({ conditionalLogic })}
              />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
