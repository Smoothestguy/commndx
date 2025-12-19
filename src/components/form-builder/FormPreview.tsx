import { FormField, FormTheme, FormRow, CoreFieldsConfig, DEFAULT_CORE_FIELDS } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
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
import { Upload, PenLine, Mail, Phone, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddressField } from "./AddressField";
import { FormattedPhoneInput } from "./FormattedPhoneInput";

interface FormPreviewProps {
  name: string;
  description: string;
  fields: FormField[];
  layout?: FormRow[];
  theme: FormTheme;
  successMessage?: string;
  coreFields?: CoreFieldsConfig;
}

// Helper function to render fields based on layout
function renderFieldsWithLayout(
  fields: FormField[], 
  layout: FormRow[] | undefined, 
  renderField: (field: FormField) => React.ReactNode
) {
  // If we have a layout, use it
  if (layout && layout.length > 0) {
    const fieldMap = new Map(fields.map(f => [f.id, f]));
    
    return layout.map((row, rowIndex) => {
      const rowFields = row.fieldIds
        .map(id => fieldMap.get(id))
        .filter((f): f is FormField => f !== undefined);
      
      if (rowFields.length === 0) return null;

      const gridClass = rowFields.length === 1 
        ? "grid-cols-1" 
        : rowFields.length === 2 
          ? "grid-cols-2" 
          : "grid-cols-3";

      return (
        <div key={row.id || rowIndex} className={cn("grid gap-3", gridClass)}>
          {rowFields.map((field) => (
            <div key={field.id}>
              {renderField(field)}
            </div>
          ))}
        </div>
      );
    });
  }

  // Fallback: render each field as full width
  return fields.map((field) => (
    <div key={field.id}>{renderField(field)}</div>
  ));
}

export function FormPreview({ name, description, fields, layout, theme, successMessage, coreFields }: FormPreviewProps) {
  // Merge provided coreFields with defaults
  const activeCoreFields: CoreFieldsConfig = {
    ...DEFAULT_CORE_FIELDS,
    ...coreFields,
  };

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

    // Grid layout for options
    const optionGridClass = field.optionLayout === "grid" 
      ? "grid grid-cols-2 sm:grid-cols-3 gap-2" 
      : "space-y-2";

    switch (field.type) {
      case "section":
        return (
          <div key={field.id} className="pt-4 pb-2 border-b col-span-full">
            <h3 className="text-lg font-semibold">{field.label || "Section Title"}</h3>
            {field.helpText && (
              <p className="text-sm text-muted-foreground mt-1">{field.helpText}</p>
            )}
          </div>
        );

      case "firstname":
      case "lastname":
      case "text":
        return (
          <div key={field.id} className="space-y-2">
            {commonLabel}
            <Input 
              type="text"
              placeholder={field.placeholder || ""} 
              defaultValue={field.defaultValue}
              disabled 
            />
            {helpText}
          </div>
        );

      case "email":
        return (
          <div key={field.id} className="space-y-2">
            {commonLabel}
            <div className="relative flex items-center">
              {field.showIcon !== false && (
                <div className="absolute left-0 flex items-center justify-center w-10 h-full bg-muted border border-r-0 rounded-l-md">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <Input 
                type="email"
                placeholder={field.placeholder || ""} 
                defaultValue={field.defaultValue}
                className={field.showIcon !== false ? "pl-12 rounded-l-none" : ""}
                disabled 
              />
            </div>
            {helpText}
          </div>
        );

      case "phone":
        return (
          <div key={field.id}>
            {field.showIcon !== false ? (
              <FormattedPhoneInput
                label={field.label}
                required={field.required}
                disabled
                helpText={field.helpText}
                showIcon={true}
              />
            ) : (
              <div className="space-y-2">
                {commonLabel}
                <Input 
                  type="tel"
                  placeholder={field.placeholder || ""} 
                  defaultValue={field.defaultValue}
                  disabled 
                />
                {helpText}
              </div>
            )}
          </div>
        );

      case "address":
        return (
          <div key={field.id} className="col-span-full">
            <AddressField
              label={field.label}
              required={field.required}
              disabled
              helpText={field.helpText}
            />
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
                {field.options?.filter(opt => opt && opt.trim() !== '').map((opt) => (
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
            <div className={optionGridClass}>
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
            <RadioGroup disabled className={optionGridClass}>
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
        <Card 
          className={cn(
            isFullWidth && "border-0 shadow-none bg-transparent",
            !isFullWidth && (theme.backgroundImage || theme.backgroundGradient) && "backdrop-blur-lg shadow-xl border-white/20"
          )}
          style={
            !isFullWidth && (theme.backgroundImage || theme.backgroundGradient)
              ? { backgroundColor: `rgba(255, 255, 255, ${(theme.cardOpacity ?? 90) / 100})` }
              : undefined
          }
        >
          <CardHeader className={cn(isFullWidth && "px-0")}>
            <CardTitle className="text-lg">
              {name || "Untitled Form"}
            </CardTitle>
            {description && (
              <CardDescription>{description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className={cn("space-y-4", isFullWidth && "px-0")}>
            {/* Profile Picture - Core Field */}
            {activeCoreFields.profilePicture && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Profile Picture</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center bg-muted/30 border-muted-foreground/25">
                  <Camera className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max 5MB
                  </p>
                </div>
              </div>
            )}

            {/* Core Fields Preview - conditionally rendered */}
            {(activeCoreFields.firstName || activeCoreFields.lastName) && (
              <div className="grid grid-cols-2 gap-3">
                {activeCoreFields.firstName && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">First Name *</Label>
                    <Input placeholder="John" disabled />
                  </div>
                )}
                {activeCoreFields.lastName && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Last Name *</Label>
                    <Input placeholder="Doe" disabled />
                  </div>
                )}
              </div>
            )}
            {(activeCoreFields.email || activeCoreFields.phone) && (
              <div className="grid grid-cols-2 gap-3">
                {activeCoreFields.email && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Email *</Label>
                    <div className="relative flex items-center">
                      <div className="absolute left-0 flex items-center justify-center w-10 h-full bg-muted border border-r-0 rounded-l-md">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input type="email" placeholder="john@example.com" className="pl-12 rounded-l-none" disabled />
                    </div>
                  </div>
                )}
                {activeCoreFields.phone && (
                  <FormattedPhoneInput
                    label="Phone *"
                    disabled
                    showIcon
                  />
                )}
              </div>
            )}
            {activeCoreFields.homeZip && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Home ZIP Code</Label>
                <Input placeholder="12345" disabled className="w-1/3 min-w-[120px]" />
              </div>
            )}

            {/* Custom Fields with row-based layout */}
            {fields.length > 0 && (
              <div className="space-y-4">
                {renderFieldsWithLayout(fields, layout, renderField)}
              </div>
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
