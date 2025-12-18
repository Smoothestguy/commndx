import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Save,
  ArrowLeft,
  Type,
  AlignLeft,
  Hash,
  List,
  CheckSquare,
  Circle,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useApplicationFormTemplate,
  useCreateApplicationFormTemplate,
  useUpdateApplicationFormTemplate,
  FormField,
} from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { toast } from "sonner";

const FIELD_TYPES = [
  { value: "text", label: "Short Text", icon: Type },
  { value: "textarea", label: "Long Text", icon: AlignLeft },
  { value: "number", label: "Number", icon: Hash },
  { value: "dropdown", label: "Dropdown", icon: List },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "radio", label: "Radio Buttons", icon: Circle },
  { value: "date", label: "Date", icon: Calendar },
] as const;

export default function ApplicationFormBuilder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const { data: existingTemplate, isLoading } = useApplicationFormTemplate(id || "");
  const createTemplate = useCreateApplicationFormTemplate();
  const updateTemplate = useUpdateApplicationFormTemplate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Initialize form with existing data
  if (isEditing && existingTemplate && !initialized) {
    setName(existingTemplate.name);
    setDescription(existingTemplate.description || "");
    setFields(existingTemplate.fields);
    setInitialized(true);
  }

  const addField = (type: FormField["type"]) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label: "",
      required: false,
      placeholder: "",
      options: type === "dropdown" || type === "radio" ? ["Option 1", "Option 2"] : undefined,
    };
    setFields([...fields, newField]);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const moveField = (from: number, to: number) => {
    if (to < 0 || to >= fields.length) return;
    const newFields = [...fields];
    const [removed] = newFields.splice(from, 1);
    newFields.splice(to, 0, removed);
    setFields(newFields);
  };

  const updateOption = (fieldIndex: number, optionIndex: number, value: string) => {
    const newFields = [...fields];
    const options = [...(newFields[fieldIndex].options || [])];
    options[optionIndex] = value;
    newFields[fieldIndex].options = options;
    setFields(newFields);
  };

  const addOption = (fieldIndex: number) => {
    const newFields = [...fields];
    const options = [...(newFields[fieldIndex].options || [])];
    options.push(`Option ${options.length + 1}`);
    newFields[fieldIndex].options = options;
    setFields(newFields);
  };

  const removeOption = (fieldIndex: number, optionIndex: number) => {
    const newFields = [...fields];
    const options = (newFields[fieldIndex].options || []).filter((_, i) => i !== optionIndex);
    newFields[fieldIndex].options = options;
    setFields(newFields);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a form name");
      return;
    }

    // Validate all fields have labels
    const invalidFields = fields.filter(f => !f.label.trim());
    if (invalidFields.length > 0) {
      toast.error("All fields must have a label");
      return;
    }

    try {
      if (isEditing && id) {
        await updateTemplate.mutateAsync({
          id,
          name,
          description,
          fields,
        });
        toast.success("Form template updated");
      } else {
        await createTemplate.mutateAsync({
          name,
          description,
          fields,
        });
        toast.success("Form template created");
      }
      navigate("/staffing/form-templates");
    } catch (error) {
      toast.error("Failed to save form template");
    }
  };

  if (isEditing && isLoading) {
    return <div className="container mx-auto py-6 px-4">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/staffing/form-templates")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {isEditing ? "Edit Form Template" : "Create Form Template"}
          </h1>
          <p className="text-muted-foreground">
            Build custom application forms for job postings
          </p>
        </div>
        <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Builder */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Form Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Form Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Warehouse Worker Application"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this form..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>
                Add fields to collect additional information. Core fields (Name, Email, Phone, ZIP) are always included.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  No custom fields yet. Add fields from the sidebar.
                </div>
              ) : (
                fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="border rounded-lg p-4 space-y-3 bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={field.label}
                          onChange={(e) => updateField(index, { label: e.target.value })}
                          placeholder="Field label"
                          className="flex-1"
                        />
                        <Select
                          value={field.type}
                          onValueChange={(value) => updateField(index, { 
                            type: value as FormField["type"],
                            options: value === "dropdown" || value === "radio" ? ["Option 1", "Option 2"] : undefined
                          })}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveField(index, index - 1)}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveField(index, index + 1)}
                          disabled={index === fields.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removeField(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {(field.type === "text" || field.type === "textarea" || field.type === "number") && (
                        <div>
                          <Label className="text-xs">Placeholder</Label>
                          <Input
                            value={field.placeholder || ""}
                            onChange={(e) => updateField(index, { placeholder: e.target.value })}
                            placeholder="Placeholder text"
                            className="h-8"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={field.required}
                          onCheckedChange={(checked) => updateField(index, { required: checked })}
                        />
                        <Label className="text-xs">Required</Label>
                      </div>
                    </div>

                    {(field.type === "dropdown" || field.type === "radio") && (
                      <div className="space-y-2">
                        <Label className="text-xs">Options</Label>
                        {field.options?.map((option, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <Input
                              value={option}
                              onChange={(e) => updateOption(index, optIndex, e.target.value)}
                              className="h-8"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeOption(index, optIndex)}
                              disabled={(field.options?.length || 0) <= 1}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addOption(index)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Option
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Field Types Sidebar */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Add Field</CardTitle>
              <CardDescription>Click to add a new field</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {FIELD_TYPES.map((type) => (
                <Button
                  key={type.value}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => addField(type.value)}
                >
                  <type.icon className="h-4 w-4 mr-2" />
                  {type.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
