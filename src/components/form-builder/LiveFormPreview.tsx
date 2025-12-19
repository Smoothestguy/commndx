import { FormField, FormRow, FormTheme, CoreFieldsConfig, DEFAULT_CORE_FIELDS } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { FormPreview } from "./FormPreview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveFormPreviewProps {
  name: string;
  description: string;
  fields: FormField[];
  layout: FormRow[];
  theme: FormTheme;
  successMessage: string;
  coreFields: CoreFieldsConfig;
  onExpandClick?: () => void;
}

export function LiveFormPreview({
  name,
  description,
  fields,
  layout,
  theme,
  successMessage,
  coreFields,
  onExpandClick,
}: LiveFormPreviewProps) {
  return (
    <Card className="sticky top-6 h-fit max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
      <CardHeader className="py-3 px-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Live Preview
          </CardTitle>
          {onExpandClick && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onExpandClick}
              className="h-7 text-xs"
            >
              <Maximize2 className="h-3 w-3 mr-1" />
              Full Preview
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-auto flex-1">
        <div className="transform scale-[0.75] origin-top-left w-[133.33%]">
          <FormPreview
            name={name || "Untitled Form"}
            description={description}
            fields={fields}
            layout={layout}
            theme={theme}
            successMessage={successMessage}
            coreFields={coreFields}
          />
        </div>
      </CardContent>
    </Card>
  );
}
