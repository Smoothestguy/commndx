import { FormField, FormTheme } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormPreviewProps {
  name: string;
  description: string;
  fields: FormField[];
  theme: FormTheme;
  successMessage?: string;
}

export function FormPreview({ name, description, fields, theme, successMessage }: FormPreviewProps) {
  const getBackgroundStyle = () => {
    if (theme.backgroundImage) {
      return {
        backgroundImage: `url(${theme.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    if (theme.backgroundGradient) {
      return { background: theme.backgroundGradient };
    }
    return { backgroundColor: theme.backgroundColor || "#f8fafc" };
  };

  const renderField = (field: FormField) => {
    const commonLabel = (
      <Label className="text-sm font-medium">
        {field.label || "Untitled Field"}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
    );

    const helpText = field.helpText && (
      <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
    );

    switch (field.type) {
      case "section":
        return (
          <div key={field.id} className="pt-4 pb-2 border-b">
            <h3 className="text-lg font-semibold">{field.label || "Section Title"}</h3>
            {field.helpText && (
              <p className="text-sm text-muted-foreground mt-1">{field.helpText}</p>
            )}
          </div>
        );

      case "text":
      case "email":
      case "phone":
        return (
          <div key={field.id} className="space-y-2">
            {commonLabel}
            <Input 
              type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
              placeholder={field.placeholder || ""} 
              defaultValue={field.defaultValue}
              disabled 
            />
            {helpText}
          </div>
        );

      case "textarea":
        return (
          <div key={field.id} className="space-y-2">
            {commonLabel}
            <Textarea 
              placeholder={field.placeholder || ""} 
              defaultValue={field.defaultValue}
              className="min-h-[80px]"
              disabled 
            />
            {helpText}
          </div>
        );

      case "number":
        return (
          <div key={field.id} className="space-y-2">
            {commonLabel}
            <Input 
              type="number" 
              placeholder={field.placeholder || ""} 
              defaultValue={field.defaultValue}
              disabled 
            />
            {helpText}
          </div>
        );

      case "date":
        return (
          <div key={field.id} className="space-y-2">
            {commonLabel}
            <Input type="date" defaultValue={field.defaultValue} disabled />
            {helpText}
          </div>
        );

      case "dropdown":
        return (
          <div key={field.id} className="space-y-2">
            {commonLabel}
            <Select disabled>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label?.toLowerCase() || "option"}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {helpText}
          </div>
        );

      case "multiselect":
        return (
          <div key={field.id} className="space-y-2">
            {commonLabel}
            <div className="space-y-2">
              {field.options?.map((opt) => (
                <div key={opt} className="flex items-center gap-2">
                  <Checkbox disabled />
                  <Label className="font-normal text-sm">{opt}</Label>
                </div>
              ))}
            </div>
            {helpText}
          </div>
        );

      case "checkbox":
        return (
          <div key={field.id} className="flex items-start gap-3">
            <Checkbox disabled />
            <div className="space-y-1">
              <Label className="font-medium text-sm">
                {field.label || "Untitled Checkbox"}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {helpText}
            </div>
          </div>
        );

      case "radio":
        return (
          <div key={field.id} className="space-y-2">
            {commonLabel}
            <RadioGroup disabled>
              {field.options?.map((opt) => (
                <div key={opt} className="flex items-center gap-2">
                  <RadioGroupItem value={opt} disabled />
                  <Label className="font-normal text-sm">{opt}</Label>
                </div>
              ))}
            </RadioGroup>
            {helpText}
          </div>
        );

      case "file":
        return (
          <div key={field.id} className="space-y-2">
            {commonLabel}
            <div className="border-2 border-dashed rounded-lg p-4 text-center bg-muted/30">
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Click to upload or drag and drop
              </p>
              {field.acceptedFileTypes && (
                <p className="text-xs text-muted-foreground mt-1">
                  {field.acceptedFileTypes.join(", ")} • Max {field.maxFileSize || 5}MB
                </p>
              )}
            </div>
            {helpText}
          </div>
        );

      case "signature":
        return (
          <div key={field.id} className="space-y-2">
            {commonLabel}
            <div className="border rounded-lg p-4 bg-muted/30 h-24 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <PenLine className="h-6 w-6 mx-auto mb-2" />
                <p className="text-sm">Click to sign</p>
              </div>
            </div>
            {helpText}
          </div>
        );

      default:
        return null;
    }
  };

  const isFullWidth = theme.layout === "fullwidth";

  return (
    <div 
      className={cn(
        "min-h-[400px] rounded-lg overflow-hidden",
        isFullWidth ? "p-4" : "p-6"
      )}
      style={{
        ...getBackgroundStyle(),
        fontFamily: theme.fontFamily || "inherit",
      }}
    >
      <div className={cn(
        "mx-auto",
        isFullWidth ? "max-w-full" : "max-w-xl"
      )}>
        <Card className={cn(
          isFullWidth && "border-0 shadow-none bg-transparent"
        )}>
          <CardHeader className={cn(isFullWidth && "px-0")}>
            <CardTitle className="text-lg">
              {name || "Untitled Form"}
            </CardTitle>
            {description && (
              <CardDescription>{description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className={cn("space-y-4", isFullWidth && "px-0")}>
            {/* Core Fields Preview */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">First Name *</Label>
                <Input placeholder="John" disabled />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Last Name *</Label>
                <Input placeholder="Doe" disabled />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Email *</Label>
                <Input type="email" placeholder="john@example.com" disabled />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Phone *</Label>
                <Input type="tel" placeholder="5551234567" disabled />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Home ZIP Code</Label>
              <Input placeholder="12345" disabled />
            </div>

            {/* Custom Fields */}
            {fields.length > 0 && (
              <>
                <div className="border-t pt-4 mt-4">
                  <p className="text-xs text-muted-foreground mb-3">Additional Questions</p>
                </div>
                {fields.map(renderField)}
              </>
            )}

            {/* Submit Button */}
            <Button 
              className="w-full mt-4" 
              disabled
              style={{
                backgroundColor: theme.buttonColor || undefined,
                color: theme.buttonTextColor || undefined,
              }}
            >
              {theme.buttonText || "Submit Application"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
