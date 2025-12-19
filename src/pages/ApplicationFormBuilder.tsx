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
  User,
  MapPin,
  Settings,
  Send,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  usePublishApplicationFormTemplate,
  FormField,
  FormRow,
  FormTheme,
  FormSettings,
  CoreFieldsConfig,
  DEFAULT_CORE_FIELDS,
  TEMPLATE_CATEGORIES,
  TemplateCategory,
} from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { RowBasedFieldGrid } from "@/components/form-builder/RowBasedFieldGrid";
import { ThemeEditor } from "@/components/form-builder/ThemeEditor";
import { FormPreview } from "@/components/form-builder/FormPreview";
import { FormSettingsPanel } from "@/components/form-builder/FormSettingsPanel";
import { CoreFieldsCard } from "@/components/form-builder/CoreFieldsCard";
import { LiveFormPreview } from "@/components/form-builder/LiveFormPreview";
import { toast } from "sonner";

const FIELD_TYPES = [
  { value: "firstname", label: "First Name", icon: User },
  { value: "lastname", label: "Last Name", icon: User },
  { value: "text", label: "Short Text", icon: Type },
  { value: "textarea", label: "Long Text", icon: AlignLeft },
  { value: "number", label: "Number", icon: Hash },
  { value: "address", label: "Address", icon: MapPin },
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

export default function ApplicationFormBuilder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const { data: existingTemplate, isLoading } = useApplicationFormTemplate(id || "");
  const createTemplate = useCreateApplicationFormTemplate();
  const updateTemplate = useUpdateApplicationFormTemplate();
  const publishTemplate = usePublishApplicationFormTemplate();

  const [activeTab, setActiveTab] = useState("fields");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TemplateCategory | null>(null);
  const [successMessage, setSuccessMessage] = useState("Thank you for your submission!");
  const [fields, setFields] = useState<FormField[]>([]);
  const [layout, setLayout] = useState<FormRow[]>([]);
  const [theme, setTheme] = useState<FormTheme>({});
  const [settings, setSettings] = useState<FormSettings>({});
  const [coreFields, setCoreFields] = useState<CoreFieldsConfig>(DEFAULT_CORE_FIELDS);
  const [isDraft, setIsDraft] = useState(true);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
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
      setSettings(existingTemplate.settings || {});
      setCoreFields(existingTemplate.settings?.coreFields || DEFAULT_CORE_FIELDS);
      setIsDraft(existingTemplate.is_draft !== false);
      setPublishedAt(existingTemplate.published_at || null);
      
      // Initialize layout from existing or generate from fields
      if (existingTemplate.layout && existingTemplate.layout.length > 0) {
        setLayout(existingTemplate.layout);
      } else {
        // Generate layout with each field in its own row
        const generatedLayout: FormRow[] = existingTemplate.fields.map(f => ({
          id: `row_${f.id}`,
          fieldIds: [f.id]
        }));
        setLayout(generatedLayout);
      }
      
      setInitialized(true);
    }
  }, [isEditing, existingTemplate, initialized]);

  const addField = (type: FormField["type"]) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label: "",
      required: false,
      placeholder: "",
      defaultVisible: true,
      options: ["dropdown", "radio", "multiselect"].includes(type) 
        ? ["Option 1", "Option 2"] 
        : undefined,
    };
    
    // Add field to fields array
    setFields([...fields, newField]);
    
    // Add new row for this field
    const newRow: FormRow = {
      id: `row_${newField.id}`,
      fieldIds: [newField.id],
    };
    setLayout([...layout, newRow]);
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  const removeField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const updateOption = (fieldId: string, optionIndex: number, value: string) => {
    setFields(fields.map(f => {
      if (f.id === fieldId) {
        const options = [...(f.options || [])];
        options[optionIndex] = value;
        return { ...f, options };
      }
      return f;
    }));
  };

  const addOption = (fieldId: string) => {
    setFields(fields.map(f => {
      if (f.id === fieldId) {
        const options = [...(f.options || [])];
        options.push(`Option ${options.length + 1}`);
        return { ...f, options };
      }
      return f;
    }));
  };

  const removeOption = (fieldId: string, optionIndex: number) => {
    setFields(fields.map(f => {
      if (f.id === fieldId) {
        const options = (f.options || []).filter((_, i) => i !== optionIndex);
        return { ...f, options };
      }
      return f;
    }));
  };

  const handleSave = async (asDraft = true) => {
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

    const settingsWithCoreFields = { ...settings, coreFields };
    
    try {
      if (isEditing && id) {
        await updateTemplate.mutateAsync({
          id,
          name,
          description,
          fields,
          layout,
          theme,
          category,
          success_message: successMessage,
          settings: settingsWithCoreFields,
          is_draft: asDraft,
        });
        setIsDraft(asDraft);
        toast.success(asDraft ? "Draft saved" : "Form saved");
      } else {
        const result = await createTemplate.mutateAsync({
          name,
          description,
          fields,
          layout,
          theme,
          category,
          success_message: successMessage,
          settings: settingsWithCoreFields,
        });
        toast.success("Form template created");
        navigate(`/staffing/form-templates/${result.id}`);
        return;
      }
    } catch (error) {
      toast.error("Failed to save form template");
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    
    // First save the current state
    await handleSave(false);
    
    try {
      await publishTemplate.mutateAsync(id);
      setIsDraft(false);
      setPublishedAt(new Date().toISOString());
      toast.success("Form published successfully!");
    } catch (error) {
      toast.error("Failed to publish form");
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              {isEditing ? "Edit Form Template" : "Create Form Template"}
            </h1>
            {isEditing && (
              <Badge variant={isDraft ? "secondary" : "default"}>
                {isDraft ? "Draft" : "Published"}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {publishedAt && !isDraft 
              ? `Last published: ${new Date(publishedAt).toLocaleDateString()}`
              : "Build custom application forms with drag-and-drop"
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => handleSave(true)} 
            disabled={createTemplate.isPending || updateTemplate.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          {isEditing && (
            <Button 
              onClick={handlePublish} 
              disabled={createTemplate.isPending || updateTemplate.isPending || publishTemplate.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {publishTemplate.isPending ? "Publishing..." : "Publish"}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="fields" className="gap-2">
            <FileText className="h-4 w-4" />
            Fields
          </TabsTrigger>
          <TabsTrigger value="style" className="gap-2">
            <Paintbrush className="h-4 w-4" />
            Style
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Fields Tab */}
        <TabsContent value="fields" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Form Builder - Left Side */}
            <div className="xl:col-span-5 space-y-4">
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
                </CardContent>
              </Card>

              <CoreFieldsCard
                coreFields={coreFields}
                onChange={setCoreFields}
                settings={settings}
                onSettingsChange={setSettings}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Custom Fields</CardTitle>
                  <CardDescription>
                    Drag fields to reorder. Fields in the same row auto-size (1=100%, 2=50%, 3=33%).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RowBasedFieldGrid
                    fields={fields}
                    layout={layout}
                    onLayoutChange={setLayout}
                    onFieldUpdate={updateField}
                    onFieldRemove={removeField}
                    onUpdateOption={updateOption}
                    onAddOption={addOption}
                    onRemoveOption={removeOption}
                    fieldTypes={FIELD_TYPES}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Live Preview - Center (visible on xl screens) */}
            <div className="hidden xl:block xl:col-span-5">
              <LiveFormPreview
                name={name}
                description={description}
                fields={fields}
                layout={layout}
                theme={theme}
                successMessage={successMessage}
                coreFields={coreFields}
                onExpandClick={() => setActiveTab("preview")}
              />
            </div>

            {/* Field Types Sidebar - Right */}
            <div className="xl:col-span-2">
              <Card className="sticky top-6">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Add Field</CardTitle>
                  <CardDescription className="text-xs">Click to add a new field</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-1.5 pt-0">
                  {FIELD_TYPES.map((type) => (
                    <Button
                      key={type.value}
                      variant="outline"
                      className="h-auto py-2 px-2 flex flex-col items-center gap-1 text-[10px]"
                      onClick={() => addField(type.value)}
                    >
                      <type.icon className="h-3.5 w-3.5" />
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
                  layout={layout}
                  theme={theme}
                  successMessage={successMessage}
                  coreFields={coreFields}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FormSettingsPanel
              successMessage={successMessage}
              onSuccessMessageChange={setSuccessMessage}
              settings={settings}
              onSettingsChange={setSettings}
            />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Version Info
                </CardTitle>
                <CardDescription>
                  Form versioning and publishing status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={isDraft ? "secondary" : "default"}>
                      {isDraft ? "Draft" : "Published"}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Version:</span>
                    <span>{existingTemplate?.version || 1}</span>
                  </div>
                  {publishedAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Published:</span>
                      <span>{new Date(publishedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    <strong>Safe editing:</strong> Changes to drafts don't affect live forms. 
                    Submissions are tied to the version they were submitted on.
                  </p>
                </div>
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
                layout={layout}
                theme={theme}
                successMessage={successMessage}
                coreFields={coreFields}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
