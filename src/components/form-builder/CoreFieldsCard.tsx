import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { User, Mail, Phone, MapPin, Camera } from "lucide-react";
import { CoreFieldsConfig, DEFAULT_CORE_FIELDS } from "@/integrations/supabase/hooks/useApplicationFormTemplates";

interface CoreFieldsCardProps {
  coreFields: CoreFieldsConfig;
  onChange: (coreFields: CoreFieldsConfig) => void;
}

const CORE_FIELD_OPTIONS = [
  { key: "profilePicture" as const, label: "Profile Picture", icon: Camera, required: false },
  { key: "firstName" as const, label: "First Name", icon: User, required: true },
  { key: "lastName" as const, label: "Last Name", icon: User, required: true },
  { key: "email" as const, label: "Email", icon: Mail, required: true },
  { key: "phone" as const, label: "Phone", icon: Phone, required: false },
  { key: "homeZip" as const, label: "Home ZIP Code", icon: MapPin, required: false },
];

export function CoreFieldsCard({ coreFields, onChange }: CoreFieldsCardProps) {
  const handleToggle = (key: keyof CoreFieldsConfig) => {
    onChange({
      ...coreFields,
      [key]: !coreFields[key],
    });
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
          
          return (
            <div
              key={field.key}
              className="flex items-center justify-between py-2 px-3 rounded-md border bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-background">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col">
                  <Label className="text-sm font-medium cursor-pointer">
                    {field.label}
                  </Label>
                  {field.required && isEnabled && (
                    <span className="text-xs text-muted-foreground">Required</span>
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
