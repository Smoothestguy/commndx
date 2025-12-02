import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAddBadgeTemplate, useUpdateBadgeTemplate } from "@/integrations/supabase/hooks/useBadgeTemplates";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface BadgeTemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
}

const availableFields = [
  { name: "photo", label: "Photo" },
  { name: "personnel_number", label: "Personnel Number" },
  { name: "first_name", label: "First Name" },
  { name: "last_name", label: "Last Name" },
  { name: "phone", label: "Phone" },
  { name: "email", label: "Email" },
  { name: "everify_status", label: "E-Verify Status" },
  { name: "certifications", label: "Certifications" },
  { name: "languages", label: "Languages" },
  { name: "qr_code", label: "QR Code" },
];

export const BadgeTemplateEditor = ({
  open,
  onOpenChange,
  templateId,
}: BadgeTemplateEditorProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [orientation, setOrientation] = useState("portrait");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [isSaving, setIsSaving] = useState(false);
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({
    photo: true,
    personnel_number: true,
    first_name: true,
    last_name: true,
    phone: true,
    everify_status: true,
  });

  const addMutation = useAddBadgeTemplate();
  const updateMutation = useUpdateBadgeTemplate();

  const toggleField = (fieldName: string) => {
    setEnabledFields((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }

    setIsSaving(true);

    const templateData = {
      name,
      description,
      orientation,
      background_color: backgroundColor,
    };

    addMutation.mutate(templateData, {
      onSuccess: async (template) => {
        // Create the fields
        const fields = availableFields
          .filter((field) => enabledFields[field.name])
          .map((field, index) => ({
            template_id: template.id,
            field_name: field.name,
            is_enabled: true,
            position_x: 0,
            position_y: index * 30,
            font_size: 12,
          }));

        try {
          const { error: fieldsError } = await supabase
            .from("badge_template_fields")
            .insert(fields);

          if (fieldsError) throw fieldsError;

          toast.success("Template created successfully");
          onOpenChange(false);
          
          // Reset form
          setName("");
          setDescription("");
          setOrientation("portrait");
          setBackgroundColor("#ffffff");
          setEnabledFields({
            photo: true,
            personnel_number: true,
            first_name: true,
            last_name: true,
            phone: false,
            email: false,
            everify_status: false,
          });
        } catch (error: any) {
          console.error("Error saving fields:", error);
          toast.error(error.message || "Failed to save template fields");
        } finally {
          setIsSaving(false);
        }
      },
      onError: (error: any) => {
        console.error("Error saving template:", error);
        toast.error(error.message || "Failed to save template");
        setIsSaving(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {templateId ? "Edit Badge Template" : "Create Badge Template"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="fields">Fields</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Standard ID Badge"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this badge template..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orientation">Orientation</Label>
              <Select value={orientation} onValueChange={setOrientation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundColor">Background Color</Label>
              <div className="flex gap-2">
                <Input
                  id="backgroundColor"
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  placeholder="#ffffff"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fields" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Select Fields to Include</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {availableFields.map((field) => (
                  <div
                    key={field.name}
                    className="flex items-center justify-between"
                  >
                    <Label htmlFor={field.name} className="cursor-pointer">
                      {field.label}
                    </Label>
                    <Switch
                      id={field.name}
                      checked={enabledFields[field.name] || false}
                      onCheckedChange={() => toggleField(field.name)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {templateId ? "Update Template" : "Create Template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
