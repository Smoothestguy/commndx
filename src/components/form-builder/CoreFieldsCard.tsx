import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, MapPin, Camera, AlertCircle } from "lucide-react";
import { CoreFieldsConfig, FormSettings } from "@/integrations/supabase/hooks/useApplicationFormTemplates";

interface CoreFieldsCardProps {
  coreFields: CoreFieldsConfig;
  onChange: (coreFields: CoreFieldsConfig) => void;
  settings?: FormSettings;
  onSettingsChange?: (settings: FormSettings) => void;
}

const CORE_FIELD_OPTIONS = [
  { key: "profilePicture" as const, label: "Profile Picture", icon: Camera, alwaysRequired: false, canBeRequired: true },
  { key: "firstName" as const, label: "First Name", icon: User, alwaysRequired: true, canBeRequired: false },
  { key: "lastName" as const, label: "Last Name", icon: User, alwaysRequired: true, canBeRequired: false },
  { key: "email" as const, label: "Email", icon: Mail, alwaysRequired: true, canBeRequired: false },
  { key: "phone" as const, label: "Phone", icon: Phone, alwaysRequired: false, canBeRequired: true },
  { key: "homeZip" as const, label: "Home ZIP Code", icon: MapPin, alwaysRequired: false, canBeRequired: true },
];

export function CoreFieldsCard({ coreFields, onChange, settings, onSettingsChange }: CoreFieldsCardProps) {
  const handleToggle = (key: keyof CoreFieldsConfig) => {
    const newValue = !coreFields[key];
    onChange({
      ...coreFields,
      [key]: newValue,
    });
    
    // If enabling profile picture, default to required
    if (key === "profilePicture" && newValue && onSettingsChange && settings) {
      onSettingsChange({
        ...settings,
        requireProfilePhoto: true,
      });
    }
    // If disabling profile picture, also disable the requirement
    if (key === "profilePicture" && !newValue && onSettingsChange && settings) {
      onSettingsChange({
        ...settings,
        requireProfilePhoto: false,
      });
    }
  };

  const handleRequiredToggle = (key: string) => {
    if (!onSettingsChange || !settings) return;
    
    if (key === "profilePicture") {
      onSettingsChange({
        ...settings,
        requireProfilePhoto: !settings.requireProfilePhoto,
      });
    }
  };

  const isFieldRequired = (key: string): boolean => {
    if (key === "profilePicture") {
      return settings?.requireProfilePhoto ?? true; // Default to true when enabled
    }
    // firstName, lastName, email are always required
    const field = CORE_FIELD_OPTIONS.find(f => f.key === key);
    return field?.alwaysRequired ?? false;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Core Fields</CardTitle>
        <CardDescription>
          Built-in fields that appear at the top of every form
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {CORE_FIELD_OPTIONS.map((field) => {
          const Icon = field.icon;
          const isEnabled = coreFields[field.key];
          const isRequired = isFieldRequired(field.key);
          const showRequiredToggle = field.canBeRequired && isEnabled && field.key === "profilePicture";
          
          return (
            <div
              key={field.key}
              className="flex items-center justify-between py-2 px-3 rounded-md border bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-background">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-sm font-medium cursor-pointer">
                    {field.label}
                  </Label>
                  {isEnabled && (
                    <div className="flex items-center gap-2">
                      {field.alwaysRequired ? (
                        <Badge variant="secondary" className="text-xs py-0 h-5">
                          Always Required
                        </Badge>
                      ) : showRequiredToggle ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`${field.key}-required`}
                            checked={isRequired}
                            onCheckedChange={() => handleRequiredToggle(field.key)}
                            className="h-4 w-7"
                          />
                          <Label 
                            htmlFor={`${field.key}-required`}
                            className="text-xs text-muted-foreground cursor-pointer"
                          >
                            Required
                          </Label>
                          {isRequired && (
                            <AlertCircle className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={() => handleToggle(field.key)}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
