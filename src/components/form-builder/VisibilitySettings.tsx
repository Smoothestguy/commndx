import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { FormField } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { Eye, EyeOff, Link } from "lucide-react";

interface VisibilitySettingsProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}

export function VisibilitySettings({ field, onUpdate }: VisibilitySettingsProps) {
  const isSection = field.type === "section";

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
      <Label className="text-xs font-medium">Visibility & Pre-fill</Label>

      {/* Default Visibility */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {field.defaultVisible !== false ? (
            <Eye className="h-4 w-4 text-muted-foreground" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <Label className="text-xs">Default Visible</Label>
            <p className="text-xs text-muted-foreground">
              {field.defaultVisible !== false 
                ? "Field shown by default" 
                : "Field hidden by default"}
            </p>
          </div>
        </div>
        <Switch
          checked={field.defaultVisible !== false}
          onCheckedChange={(checked) => onUpdate({ defaultVisible: checked })}
        />
      </div>

      {/* Pre-fill from URL */}
      {!isSection && (
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 mb-2">
            <Link className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs">URL Pre-fill Parameter</Label>
          </div>
          <Input
            value={field.prefillParam || ""}
            onChange={(e) => onUpdate({ prefillParam: e.target.value || undefined })}
            placeholder="e.g., email, name, source"
            className="h-8 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Pre-fill this field from URL: ?{field.prefillParam || "param"}=value
          </p>
        </div>
      )}

      {/* Info about hidden fields */}
      {field.defaultVisible === false && (
        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs">
          <p className="text-amber-700 dark:text-amber-400">
            Hidden fields are never required and won't block form submission.
          </p>
        </div>
      )}
    </div>
  );
}
