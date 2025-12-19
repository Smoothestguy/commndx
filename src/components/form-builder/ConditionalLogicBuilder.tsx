import { useState } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { FormField, ConditionalLogic, FieldCondition } from "@/integrations/supabase/hooks/useApplicationFormTemplates";

interface ConditionalLogicBuilderProps {
  field: FormField;
  allFields: FormField[];
  onUpdate: (logic: ConditionalLogic | undefined) => void;
}

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "isEmpty", label: "Is empty" },
  { value: "isNotEmpty", label: "Is not empty" },
] as const;

export function ConditionalLogicBuilder({
  field,
  allFields,
  onUpdate,
}: ConditionalLogicBuilderProps) {
  const [isOpen, setIsOpen] = useState(!!field.conditionalLogic?.enabled);

  const otherFields = allFields.filter(f => f.id !== field.id && f.type !== "section");

  const logic = field.conditionalLogic || {
    enabled: false,
    action: "show" as const,
    conditions: [],
    logicType: "all" as const,
  };

  const handleToggle = (enabled: boolean) => {
    if (!enabled) {
      onUpdate(undefined);
    } else {
      onUpdate({
        ...logic,
        enabled: true,
        conditions: logic.conditions.length > 0 ? logic.conditions : [
          { fieldId: otherFields[0]?.id || "", operator: "equals", value: "" }
        ],
      });
    }
    setIsOpen(enabled);
  };

  const updateCondition = (index: number, updates: Partial<FieldCondition>) => {
    const newConditions = [...logic.conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    onUpdate({ ...logic, conditions: newConditions });
  };

  const addCondition = () => {
    onUpdate({
      ...logic,
      conditions: [
        ...logic.conditions,
        { fieldId: otherFields[0]?.id || "", operator: "equals", value: "" }
      ],
    });
  };

  const removeCondition = (index: number) => {
    const newConditions = logic.conditions.filter((_, i) => i !== index);
    if (newConditions.length === 0) {
      onUpdate(undefined);
      setIsOpen(false);
    } else {
      onUpdate({ ...logic, conditions: newConditions });
    }
  };

  const getFieldOptions = (fieldId: string) => {
    const targetField = allFields.find(f => f.id === fieldId);
    return targetField?.options || [];
  };

  if (otherFields.length === 0) return null;

  return (
    <div className="border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={logic.enabled}
            onCheckedChange={handleToggle}
            className="scale-90"
          />
          <Label className="text-xs font-medium">Conditional Logic</Label>
        </div>
        {logic.enabled && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {logic.action === "show" ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
            <span>{logic.action === "show" ? "Show" : "Hide"} when conditions met</span>
          </div>
        )}
      </div>

      {logic.enabled && (
        <div className="mt-3 space-y-3">
          {/* Action Toggle */}
          <div className="flex items-center gap-2">
            <Select
              value={logic.action}
              onValueChange={(value: "show" | "hide") => 
                onUpdate({ ...logic, action: value })
              }
            >
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="show">Show</SelectItem>
                <SelectItem value="hide">Hide</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">this field when</span>
            <Select
              value={logic.logicType}
              onValueChange={(value: "all" | "any") => 
                onUpdate({ ...logic, logicType: value })
              }
            >
              <SelectTrigger className="w-[80px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="any">Any</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">conditions are true</span>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            {logic.conditions.map((condition, index) => {
              const targetField = allFields.find(f => f.id === condition.fieldId);
              const hasValueOptions = targetField?.options && targetField.options.length > 0;
              const needsValue = !["isEmpty", "isNotEmpty"].includes(condition.operator);

              return (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={condition.fieldId}
                    onValueChange={(value) => updateCondition(index, { fieldId: value })}
                  >
                    <SelectTrigger className="flex-1 h-8">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherFields.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label || "Untitled field"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(value) => updateCondition(index, { 
                      operator: value as FieldCondition["operator"] 
                    })}
                  >
                    <SelectTrigger className="w-[130px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {needsValue && (
                    hasValueOptions ? (
                      <Select
                        value={condition.value}
                        onValueChange={(value) => updateCondition(index, { value })}
                      >
                        <SelectTrigger className="flex-1 h-8">
                          <SelectValue placeholder="Select value" />
                        </SelectTrigger>
                        <SelectContent>
                          {getFieldOptions(condition.fieldId).map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={condition.value}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                        placeholder="Value"
                        className="flex-1 h-8"
                      />
                    )
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive shrink-0"
                    onClick={() => removeCondition(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addCondition}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Condition
          </Button>
        </div>
      )}
    </div>
  );
}
