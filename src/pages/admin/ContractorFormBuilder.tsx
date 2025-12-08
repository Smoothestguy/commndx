import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Loader2, Eye, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageLayout } from "@/components/layout/PageLayout";
import { 
  FormField, 
  useAllFormConfigurations, 
  useUpdateFormConfiguration 
} from "@/integrations/supabase/hooks/useContractorSubmissions";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";

const FIELD_TYPES = [
  { value: "text", label: "Text Input" },
  { value: "textarea", label: "Text Area" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency ($)" },
  { value: "date", label: "Date Picker" },
  { value: "dropdown", label: "Dropdown" },
  { value: "customer_select", label: "Customer Select" },
  { value: "project_select", label: "Project Select" },
  { value: "file_upload", label: "File Upload" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio Buttons" },
];

export default function ContractorFormBuilder() {
  const { data: configs, isLoading } = useAllFormConfigurations();
  const updateConfig = useUpdateFormConfiguration();
  
  const [activeTab, setActiveTab] = useState<"bill" | "expense">("bill");
  const [billFields, setBillFields] = useState<FormField[]>([]);
  const [expenseFields, setExpenseFields] = useState<FormField[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (configs) {
      const billConfig = configs.find(c => c.form_type === "bill");
      const expenseConfig = configs.find(c => c.form_type === "expense");
      if (billConfig) setBillFields(billConfig.fields);
      if (expenseConfig) setExpenseFields(expenseConfig.fields);
    }
  }, [configs]);

  const currentFields = activeTab === "bill" ? billFields : expenseFields;
  const setCurrentFields = activeTab === "bill" ? setBillFields : setExpenseFields;

  const addField = () => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      name: `field_${Date.now()}`,
      label: "New Field",
      type: "text",
      required: false,
      order: currentFields.length + 1,
    };
    setCurrentFields([...currentFields, newField]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setCurrentFields(
      currentFields.map((field) =>
        field.id === id ? { ...field, ...updates } : field
      )
    );
  };

  const removeField = (id: string) => {
    setCurrentFields(currentFields.filter((field) => field.id !== id));
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    const newFields = [...currentFields];
    const [removed] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, removed);
    // Update order values
    const reordered = newFields.map((field, index) => ({
      ...field,
      order: index + 1,
    }));
    setCurrentFields(reordered);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConfig.mutateAsync({
        formType: activeTab,
        fields: currentFields.map((f, i) => ({ ...f, order: i + 1 })),
      });
      toast.success(`${activeTab === "bill" ? "Bill" : "Expense"} form saved`);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save form configuration");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageLayout title="Form Builder">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <>
      <SEO
        title="Contractor Form Builder"
        description="Customize contractor submission forms"
      />
      <PageLayout 
        title="Form Builder" 
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/contractor" target="_blank">
                <Eye className="h-4 w-4 mr-2" />
                Preview Portal
              </Link>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Editor */}
          <div className="lg:col-span-2">
            <Card>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "bill" | "expense")}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Form Configuration</CardTitle>
                      <CardDescription>
                        Customize the fields contractors see when submitting
                      </CardDescription>
                    </div>
                    <TabsList>
                      <TabsTrigger value="bill" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Bill
                      </TabsTrigger>
                      <TabsTrigger value="expense" className="gap-2">
                        <Receipt className="h-4 w-4" />
                        Expense
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {currentFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="p-4 border rounded-lg bg-card space-y-4"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            className="mt-2 cursor-grab text-muted-foreground hover:text-foreground"
                            onMouseDown={(e) => {
                              // Simple drag indicator - full drag-drop would need more implementation
                            }}
                          >
                            <GripVertical className="h-5 w-5" />
                          </button>
                          
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Field Label</Label>
                              <Input
                                value={field.label}
                                onChange={(e) =>
                                  updateField(field.id, { label: e.target.value })
                                }
                                placeholder="Enter field label"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Field Type</Label>
                              <Select
                                value={field.type}
                                onValueChange={(value) =>
                                  updateField(field.id, { type: value as FormField["type"] })
                                }
                              >
                                <SelectTrigger>
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

                            <div className="space-y-2">
                              <Label>Field Name (Internal)</Label>
                              <Input
                                value={field.name}
                                onChange={(e) =>
                                  updateField(field.id, { 
                                    name: e.target.value.toLowerCase().replace(/\s+/g, "_") 
                                  })
                                }
                                placeholder="field_name"
                              />
                            </div>

                            <div className="flex items-center gap-4 pt-6">
                              <div className="flex items-center gap-2">
                                <Switch
                                  id={`required-${field.id}`}
                                  checked={field.required}
                                  onCheckedChange={(checked) =>
                                    updateField(field.id, { required: checked })
                                  }
                                />
                                <Label htmlFor={`required-${field.id}`}>Required</Label>
                              </div>
                            </div>

                            {/* Options for dropdown/radio */}
                            {(field.type === "dropdown" || field.type === "radio") && (
                              <div className="col-span-2 space-y-2">
                                <Label>Options (comma-separated)</Label>
                                <Input
                                  value={field.options?.join(", ") || ""}
                                  onChange={(e) =>
                                    updateField(field.id, {
                                      options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                                    })
                                  }
                                  placeholder="Option 1, Option 2, Option 3"
                                />
                              </div>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeField(field.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Move buttons */}
                        <div className="flex gap-2 pl-8">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={index === 0}
                            onClick={() => moveField(index, index - 1)}
                          >
                            Move Up
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={index === currentFields.length - 1}
                            onClick={() => moveField(index, index + 1)}
                          >
                            Move Down
                          </Button>
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={addField}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field
                    </Button>
                  </div>
                </CardContent>
              </Tabs>
            </Card>
          </div>

          {/* Live Preview */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">Live Preview</CardTitle>
                <CardDescription>
                  How contractors will see the form
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  {currentFields.map((field) => (
                    <div key={field.id} className="space-y-1">
                      <label className="text-sm font-medium">
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </label>
                      {field.type === "textarea" ? (
                        <div className="h-20 bg-background border rounded-md" />
                      ) : field.type === "file_upload" ? (
                        <div className="h-24 bg-background border-2 border-dashed rounded-md flex items-center justify-center text-xs text-muted-foreground">
                          Drop files here
                        </div>
                      ) : field.type === "checkbox" ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border rounded" />
                          <span className="text-sm text-muted-foreground">
                            {field.placeholder || field.label}
                          </span>
                        </div>
                      ) : (
                        <div className="h-10 bg-background border rounded-md" />
                      )}
                    </div>
                  ))}
                  
                  <div className="pt-4">
                    <div className="h-10 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-sm font-medium">
                      Submit {activeTab === "bill" ? "Bill" : "Expense"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageLayout>
    </>
  );
}
