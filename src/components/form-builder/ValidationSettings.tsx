import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/integrations/supabase/hooks/useApplicationFormTemplates";

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customErrorMessage?: string;
}

interface ValidationSettingsProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}

export function ValidationSettings({ field, onUpdate }: ValidationSettingsProps) {
  const validation = field.validation || {};
  
  const updateValidation = (updates: Partial<FieldValidation>) => {
    onUpdate({
      validation: { ...validation, ...updates }
    });
  };

  const showLengthValidation = ["text", "textarea", "firstname", "lastname"].includes(field.type);
  const showNumberValidation = field.type === "number";
  const showPatternValidation = ["text", "email", "phone"].includes(field.type);

  if (!showLengthValidation && !showNumberValidation && !showPatternValidation) {
    return null;
  }

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
      <Label className="text-xs font-medium">Validation Rules</Label>

      {/* Text length validation */}
      {showLengthValidation && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Min Length</Label>
            <Input
              type="number"
              value={validation.minLength || ""}
              onChange={(e) => updateValidation({ 
                minLength: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              placeholder="No min"
              min={0}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Max Length</Label>
            <Input
              type="number"
              value={validation.maxLength || ""}
              onChange={(e) => updateValidation({ 
                maxLength: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              placeholder="No max"
              min={1}
              className="h-8"
            />
          </div>
        </div>
      )}

      {/* Number range validation */}
      {showNumberValidation && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Min Value</Label>
            <Input
              type="number"
              step="any"
              value={validation.min ?? ""}
              onChange={(e) => updateValidation({ 
                min: e.target.value !== "" ? parseFloat(e.target.value) : undefined 
              })}
              placeholder="No min"
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Max Value</Label>
            <Input
              type="number"
              step="any"
              value={validation.max ?? ""}
              onChange={(e) => updateValidation({ 
                max: e.target.value !== "" ? parseFloat(e.target.value) : undefined 
              })}
              placeholder="No max"
              className="h-8"
            />
          </div>
        </div>
      )}

      {/* Pattern validation for text fields */}
      {showPatternValidation && field.type === "text" && (
        <div>
          <Label className="text-xs text-muted-foreground">Pattern (Regex)</Label>
          <Input
            value={validation.pattern || ""}
            onChange={(e) => updateValidation({ pattern: e.target.value || undefined })}
            placeholder="e.g., ^[A-Za-z]+$"
            className="h-8 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Regular expression for custom validation
          </p>
        </div>
      )}

      {/* Custom error message */}
      <div>
        <Label className="text-xs text-muted-foreground">Custom Error Message</Label>
        <Textarea
          value={validation.customErrorMessage || ""}
          onChange={(e) => updateValidation({ 
            customErrorMessage: e.target.value || undefined 
          })}
          placeholder="Enter a custom error message for this field..."
          className="min-h-[60px] text-sm"
        />
      </div>
    </div>
  );
}
