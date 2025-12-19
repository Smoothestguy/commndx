import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  Save,
  ArrowLeft,
  Type,
  AlignLeft,
  Hash,
  List,
  CheckSquare,
  Circle,
  Calendar,
  Mail,
  Phone,
  Upload,
  ListChecks,
  Minus,
  PenLine,
  Eye,
  Paintbrush,
  FileText,
  Loader2,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  FormTheme,
  TEMPLATE_CATEGORIES,
  TemplateCategory,
} from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { FieldSettingsPanel } from "@/components/form-builder/FieldSettingsPanel";
import { ThemeEditor } from "@/components/form-builder/ThemeEditor";
import { FormPreview } from "@/components/form-builder/FormPreview";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FIELD_TYPES = [
  { value: "text", label: "Short Text", icon: Type },
  { value: "textarea", label: "Long Text", icon: AlignLeft },
  { value: "number", label: "Number", icon: Hash },
  { value: "email", label: "Email", icon: Mail },
  { value: "phone", label: "Phone", icon: Phone },
  { value: "dropdown", label: "Dropdown", icon: List },
  { value: "multiselect", label: "Multi-Select", icon: ListChecks },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "radio", label: "Radio Buttons", icon: Circle },
  { value: "date", label: "Date", icon: Calendar },
  { value: "file", label: "File Upload", icon: Upload },
  { value: "section", label: "Section Header", icon: Minus },
  { value: "signature", label: "Signature", icon: PenLine },
] as const;

// Sortable field wrapper component
function SortableField({ 
  field, 
  index, 
  allFields,
  onUpdate, 
  onRemove,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
}: {
  field: FormField;
  index: number;
  allFields: FormField[];
  onUpdate: (updates: Partial<FormField>) => void;
  onRemove: () => void;
  onUpdateOption: (optionIndex: number, value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (optionIndex: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div {...listeners}>
        <FieldSettingsPanel
          field={field}
          index={index}
          allFields={allFields}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onUpdateOption={onUpdateOption}
          onAddOption={onAddOption}
          onRemoveOption={onRemoveOption}
          fieldTypes={FIELD_TYPES}
        />
      </div>
    </div>
  );
}

export default function ApplicationFormBuilder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const { data: existingTemplate, isLoading } = useApplicationFormTemplate(id || "");
  const createTemplate = useCreateApplicationFormTemplate();
  const updateTemplate = useUpdateApplicationFormTemplate();

  const [activeTab, setActiveTab] = useState("fields");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TemplateCategory | null>(null);
  const [successMessage, setSuccessMessage] = useState("Thank you for your submission!");
  const [fields, setFields] = useState<FormField[]>([]);
  const [theme, setTheme] = useState<FormTheme>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize form with existing data
  useEffect(() => {
    if (isEditing && existingTemplate && !initialized) {
      setName(existingTemplate.name);
      setDescription(existingTemplate.description || "");
      setCategory(existingTemplate.category || null);
      setSuccessMessage(existingTemplate.success_message || "Thank you for your submission!");
      setFields(existingTemplate.fields);
      setTheme(existingTemplate.theme || {});
      setInitialized(true);
    }
  }, [isEditing, existingTemplate, initialized]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addField = (type: FormField["type"]) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label: "",
      required: false,
      placeholder: "",
      options: ["dropdown", "radio", "multiselect"].includes(type) 
        ? ["Option 1", "Option 2"] 
        : undefined,
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

    // Validate all fields have labels (except sections which can be empty)
    const invalidFields = fields.filter(f => f.type !== "section" && !f.label.trim());
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
          theme,
          category,
          success_message: successMessage,
        });
        toast.success("Form template updated");
      } else {
        await createTemplate.mutateAsync({
          name,
          description,
          fields,
          theme,
          category,
          success_message: successMessage,
        });
        toast.success("Form template created");
      }
      navigate("/staffing/form-templates");
    } catch (error) {
      toast.error("Failed to save form template");
    }
  };

  if (isEditing && isLoading) {
    return (
      <div className="container mx-auto py-6 px-4 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/staffing/form-templates")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {isEditing ? "Edit Form Template" : "Create Form Template"}
          </h1>
          <p className="text-muted-foreground">
            Build custom application forms with drag-and-drop
          </p>
        </div>
        <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {createTemplate.isPending || updateTemplate.isPending ? "Saving..." : "Save Template"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="fields" className="gap-2">
            <FileText className="h-4 w-4" />
            Fields
          </TabsTrigger>
          <TabsTrigger value="style" className="gap-2">
            <Paintbrush className="h-4 w-4" />
            Style
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Fields Tab */}
        <TabsContent value="fields" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Builder */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Form Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Form Name *</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Warehouse Worker Application"
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={category || "none"}
                        onValueChange={(v) => setCategory(v === "none" ? null : v as TemplateCategory)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Category</SelectItem>
                          {TEMPLATE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of this form..."
                    />
                  </div>
                  <div>
                    <Label>Success Message</Label>
                    <Textarea
                      value={successMessage}
                      onChange={(e) => setSuccessMessage(e.target.value)}
                      placeholder="Thank you for your submission!"
                      className="min-h-[60px]"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Shown after successful form submission
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Custom Fields</CardTitle>
                  <CardDescription>
                    Drag to reorder. Core fields (Name, Email, Phone, ZIP) are always included.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fields.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No custom fields yet</p>
                      <p className="text-sm">Add fields from the sidebar to get started</p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={fields.map(f => f.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {fields.map((field, index) => (
                          <SortableField
                            key={field.id}
                            field={field}
                            index={index}
                            allFields={fields}
                            onUpdate={(updates) => updateField(index, updates)}
                            onRemove={() => removeField(index)}
                            onUpdateOption={(optIndex, value) => updateOption(index, optIndex, value)}
                            onAddOption={() => addOption(index)}
                            onRemoveOption={(optIndex) => removeOption(index, optIndex)}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
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
                <CardContent className="grid grid-cols-2 gap-2">
                  {FIELD_TYPES.map((type) => (
                    <Button
                      key={type.value}
                      variant="outline"
                      className="h-auto py-3 px-3 flex flex-col items-center gap-1.5 text-xs"
                      onClick={() => addField(type.value)}
                    >
                      <type.icon className="h-4 w-4" />
                      <span className="text-center leading-tight">{type.label}</span>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Style Tab */}
        <TabsContent value="style" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Visual Customization</CardTitle>
                <CardDescription>
                  Customize the appearance of your public form
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ThemeEditor theme={theme} onUpdate={setTheme} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden rounded-b-lg">
                <FormPreview
                  name={name}
                  description={description}
                  fields={fields}
                  theme={theme}
                  successMessage={successMessage}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Full Preview</CardTitle>
              <CardDescription>
                This is how your form will appear to applicants
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden rounded-b-lg">
              <FormPreview
                name={name}
                description={description}
                fields={fields}
                theme={theme}
                successMessage={successMessage}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
