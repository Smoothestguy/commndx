import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, Eye, Loader2, Building2, Trash2 } from "lucide-react";
import companyLogo from "@/assets/logo.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CustomField {
  label: string;
  value: string;
}

interface BadgeTemplate {
  id?: string;
  project_id: string | null;
  template_name: string;
  company_name: string;
  company_logo_url: string | null;
  show_photo: boolean;
  show_personnel_number: boolean;
  show_phone: boolean;
  show_email: boolean;
  show_work_authorization: boolean;
  show_everify_status: boolean;
  show_certifications: boolean;
  show_capabilities: boolean;
  show_languages: boolean;
  background_color: string;
  header_color: string;
  is_default: boolean;
  custom_fields: CustomField[];
  // Text colors
  name_color: string;
  personnel_number_color: string;
  label_color: string;
  value_color: string;
  footer_color: string;
}

export default function BadgeTemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");

  const [template, setTemplate] = useState<BadgeTemplate>({
    project_id: null,
    template_name: "",
    company_name: "Fairfield",
    company_logo_url: null,
    show_photo: true,
    show_personnel_number: true,
    show_phone: true,
    show_email: false,
    show_work_authorization: true,
    show_everify_status: true,
    show_certifications: true,
    show_capabilities: true,
    show_languages: true,
    background_color: "#ffffff",
    header_color: "#1e40af",
    is_default: false,
    custom_fields: [],
    name_color: "#000000",
    personnel_number_color: "#ea580c",
    label_color: "#374151",
    value_color: "#1f2937",
    footer_color: "#6b7280",
  });

  useEffect(() => {
    const init = async () => {
      await fetchProjects();
      if (id && id !== "new") {
        await fetchTemplate();
      }
      setInitialLoading(false);
    };
    init();
  }, [id]);

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name, customer_id")
      .eq("status", "active")
      .order("name");
    
    if (data) setProjects(data);
  };

  const fetchTemplate = async () => {
    const { data, error } = await supabase
      .from("badge_templates")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      toast.error(`Error loading template: ${error.message}`);
    } else if (data) {
      setTemplate({
        id: data.id,
        project_id: data.project_id || null,
        template_name: data.template_name || data.name || "",
        company_name: data.company_name || "Fairfield",
        company_logo_url: data.company_logo_url || null,
        show_photo: data.show_photo ?? true,
        show_personnel_number: data.show_personnel_number ?? true,
        show_phone: data.show_phone ?? true,
        show_email: data.show_email ?? false,
        show_work_authorization: data.show_work_authorization ?? true,
        show_everify_status: data.show_everify_status ?? true,
        show_certifications: data.show_certifications ?? true,
        show_capabilities: data.show_capabilities ?? true,
        show_languages: data.show_languages ?? true,
        background_color: data.background_color || "#ffffff",
        header_color: data.header_color || "#1e40af",
        is_default: data.is_default ?? false,
        custom_fields: Array.isArray(data.custom_fields) 
          ? (data.custom_fields as unknown as CustomField[]) 
          : [],
        name_color: data.name_color || "#000000",
        personnel_number_color: data.personnel_number_color || "#ea580c",
        label_color: data.label_color || "#374151",
        value_color: data.value_color || "#1f2937",
        footer_color: data.footer_color || "#6b7280",
      });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, file);

    if (uploadError) {
      toast.error(`Error uploading logo: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
    setTemplate({ ...template, company_logo_url: data.publicUrl });
    setUploading(false);
    toast.success("Logo uploaded successfully");
  };

  const addCustomField = () => {
    if (!newFieldLabel.trim()) {
      toast.error("Field label is required");
      return;
    }
    const newField: CustomField = { label: newFieldLabel, value: newFieldValue };
    setTemplate({ ...template, custom_fields: [...template.custom_fields, newField] });
    setNewFieldLabel("");
    setNewFieldValue("");
  };

  const removeCustomField = (index: number) => {
    const fields = [...template.custom_fields];
    fields.splice(index, 1);
    setTemplate({ ...template, custom_fields: fields });
  };

  const updateCustomField = (index: number, field: 'label' | 'value', newValue: string) => {
    const fields = [...template.custom_fields];
    fields[index][field] = newValue;
    setTemplate({ ...template, custom_fields: fields });
  };

  const handleSave = async () => {
    if (!template.template_name) {
      toast.error("Template name is required");
      return;
    }

    setLoading(true);

    const templateToSave = {
      name: template.template_name,
      template_name: template.template_name,
      project_id: template.project_id,
      company_name: template.company_name,
      company_logo_url: template.company_logo_url,
      show_photo: template.show_photo,
      show_personnel_number: template.show_personnel_number,
      show_phone: template.show_phone,
      show_email: template.show_email,
      show_work_authorization: template.show_work_authorization,
      show_everify_status: template.show_everify_status,
      show_certifications: template.show_certifications,
      show_capabilities: template.show_capabilities,
      show_languages: template.show_languages,
      background_color: template.background_color,
      header_color: template.header_color,
      is_default: template.is_default,
      custom_fields: JSON.parse(JSON.stringify(template.custom_fields)),
      name_color: template.name_color,
      personnel_number_color: template.personnel_number_color,
      label_color: template.label_color,
      value_color: template.value_color,
      footer_color: template.footer_color,
    };

    let error;
    if (id && id !== "new") {
      const result = await supabase
        .from("badge_templates")
        .update(templateToSave)
        .eq("id", id);
      error = result.error;
    } else {
      const result = await supabase.from("badge_templates").insert([templateToSave]);
      error = result.error;
    }

    setLoading(false);

    if (error) {
      toast.error(`Error saving template: ${error.message}`);
    } else {
      toast.success("Badge template saved");
      navigate("/badge-templates");
    }
  };

  if (initialLoading) {
    return (
      <PageLayout title="Loading..." description="">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={id && id !== "new" ? "Edit Badge Template" : "New Badge Template"}
      description="Customize badge design and fields"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/badge-templates")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleSave} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Template
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template_name">Template Name *</Label>
                <Input
                  id="template_name"
                  value={template.template_name}
                  onChange={(e) => setTemplate({ ...template, template_name: e.target.value })}
                  placeholder="e.g., Construction Site Badge"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project">Assign to Project (Optional)</Label>
                <Select
                  value={template.project_id || "none"}
                  onValueChange={(value) => setTemplate({ ...template, project_id: value === "none" ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Project (General)</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={template.company_name}
                  onChange={(e) => setTemplate({ ...template, company_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">Company Logo</Label>
                {template.company_logo_url && (
                  <div className="mb-2 flex items-center gap-2">
                    <img src={template.company_logo_url} alt="Logo" className="h-16 object-contain" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setTemplate({ ...template, company_logo_url: null })}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTemplate({ ...template, company_logo_url: companyLogo })}
                    className="gap-2"
                  >
                    <Building2 className="h-4 w-4" />
                    Use Company Logo
                  </Button>
                </div>
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                  className="mt-2"
                />
                {uploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="header_color">Header Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="header_color"
                      type="color"
                      value={template.header_color}
                      onChange={(e) => setTemplate({ ...template, header_color: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={template.header_color}
                      onChange={(e) => setTemplate({ ...template, header_color: e.target.value })}
                      placeholder="#1e40af"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="background_color">Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="background_color"
                      type="color"
                      value={template.background_color}
                      onChange={(e) => setTemplate({ ...template, background_color: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={template.background_color}
                      onChange={(e) => setTemplate({ ...template, background_color: e.target.value })}
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label htmlFor="is_default">Set as Default Template</Label>
                <Switch
                  id="is_default"
                  checked={template.is_default}
                  onCheckedChange={(checked) => setTemplate({ ...template, is_default: checked })}
                />
              </div>

              {/* Text Colors Section */}
              <div className="pt-4 border-t space-y-4">
                <h4 className="font-medium text-sm">Text Colors</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name_color">Name Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="name_color"
                        type="color"
                        value={template.name_color}
                        onChange={(e) => setTemplate({ ...template, name_color: e.target.value })}
                        className="w-12 h-10 p-1"
                      />
                      <Input
                        value={template.name_color}
                        onChange={(e) => setTemplate({ ...template, name_color: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="personnel_number_color">ID Number Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="personnel_number_color"
                        type="color"
                        value={template.personnel_number_color}
                        onChange={(e) => setTemplate({ ...template, personnel_number_color: e.target.value })}
                        className="w-12 h-10 p-1"
                      />
                      <Input
                        value={template.personnel_number_color}
                        onChange={(e) => setTemplate({ ...template, personnel_number_color: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="label_color">Label Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="label_color"
                        type="color"
                        value={template.label_color}
                        onChange={(e) => setTemplate({ ...template, label_color: e.target.value })}
                        className="w-12 h-10 p-1"
                      />
                      <Input
                        value={template.label_color}
                        onChange={(e) => setTemplate({ ...template, label_color: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="value_color">Value Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="value_color"
                        type="color"
                        value={template.value_color}
                        onChange={(e) => setTemplate({ ...template, value_color: e.target.value })}
                        className="w-12 h-10 p-1"
                      />
                      <Input
                        value={template.value_color}
                        onChange={(e) => setTemplate({ ...template, value_color: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="footer_color">Footer Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="footer_color"
                      type="color"
                      value={template.footer_color}
                      onChange={(e) => setTemplate({ ...template, footer_color: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={template.footer_color}
                      onChange={(e) => setTemplate({ ...template, footer_color: e.target.value })}
                      className="w-32"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visible Fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show_photo">Show Photo</Label>
                <Switch
                  id="show_photo"
                  checked={template.show_photo}
                  onCheckedChange={(checked) => setTemplate({ ...template, show_photo: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show_personnel_number">Show Personnel Number</Label>
                <Switch
                  id="show_personnel_number"
                  checked={template.show_personnel_number}
                  onCheckedChange={(checked) => setTemplate({ ...template, show_personnel_number: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show_phone">Show Phone</Label>
                <Switch
                  id="show_phone"
                  checked={template.show_phone}
                  onCheckedChange={(checked) => setTemplate({ ...template, show_phone: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show_email">Show Email</Label>
                <Switch
                  id="show_email"
                  checked={template.show_email}
                  onCheckedChange={(checked) => setTemplate({ ...template, show_email: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show_work_authorization">Show Work Authorization</Label>
                <Switch
                  id="show_work_authorization"
                  checked={template.show_work_authorization}
                  onCheckedChange={(checked) => setTemplate({ ...template, show_work_authorization: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show_everify_status">Show E-Verify Status</Label>
                <Switch
                  id="show_everify_status"
                  checked={template.show_everify_status}
                  onCheckedChange={(checked) => setTemplate({ ...template, show_everify_status: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show_certifications">Show Certifications</Label>
                <Switch
                  id="show_certifications"
                  checked={template.show_certifications}
                  onCheckedChange={(checked) => setTemplate({ ...template, show_certifications: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show_capabilities">Show Capabilities</Label>
                <Switch
                  id="show_capabilities"
                  checked={template.show_capabilities}
                  onCheckedChange={(checked) => setTemplate({ ...template, show_capabilities: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show_languages">Show Languages</Label>
                <Switch
                  id="show_languages"
                  checked={template.show_languages}
                  onCheckedChange={(checked) => setTemplate({ ...template, show_languages: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom Fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {template.custom_fields.map((field, index) => (
                <div key={index} className="flex gap-2 items-center p-3 bg-muted rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Field Label"
                      value={field.label}
                      onChange={(e) => updateCustomField(index, 'label', e.target.value)}
                    />
                    <Input
                      placeholder="Field Value"
                      value={field.value}
                      onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeCustomField(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              
              <div className="space-y-2 pt-4 border-t">
                <Label>Add New Field</Label>
                <Input
                  placeholder="Field Label (e.g., Department)"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                />
                <Input
                  placeholder="Field Value (e.g., Construction)"
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                />
                <Button onClick={addCustomField} className="w-full">
                  Add Custom Field
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-4 border-primary/20 rounded-lg overflow-hidden" style={{ backgroundColor: template.background_color }}>
                {/* Header */}
                <div className="p-4 text-white" style={{ backgroundColor: template.header_color }}>
                  {template.company_logo_url && (
                    <img 
                      src={template.company_logo_url} 
                      alt="Logo" 
                      className="h-12 mb-2 object-contain brightness-0 invert"
                    />
                  )}
                  <h2 className="text-xl font-bold">{template.company_name}</h2>
                  <p className="text-sm opacity-90">Personnel ID Badge</p>
                </div>

                {/* Body */}
                <div className="p-6">
                  {template.show_photo && (
                    <div className="w-32 h-32 mx-auto rounded-lg bg-muted flex items-center justify-center mb-4">
                      <span className="text-4xl">👤</span>
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <h3 className="text-2xl font-bold" style={{ color: template.name_color }}>John Doe</h3>
                    {template.show_personnel_number && (
                      <p className="font-mono font-semibold" style={{ color: template.personnel_number_color }}>P-2500001</p>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    {template.show_phone && (
                      <div className="flex justify-between py-1 border-b">
                        <span className="font-semibold" style={{ color: template.label_color }}>Phone:</span>
                        <span style={{ color: template.value_color }}>(555) 123-4567</span>
                      </div>
                    )}
                    {template.show_email && (
                      <div className="flex justify-between py-1 border-b">
                        <span className="font-semibold" style={{ color: template.label_color }}>Email:</span>
                        <span style={{ color: template.value_color }}>john@example.com</span>
                      </div>
                    )}
                    {template.show_work_authorization && (
                      <div className="flex justify-between py-1 border-b">
                        <span className="font-semibold" style={{ color: template.label_color }}>Auth:</span>
                        <span style={{ color: template.value_color }}>US CITIZEN</span>
                      </div>
                    )}
                    {template.show_everify_status && (
                      <div className="flex justify-between py-1 border-b">
                        <span className="font-semibold" style={{ color: template.label_color }}>E-Verify:</span>
                        <span className="font-semibold" style={{ color: template.value_color }}>VERIFIED</span>
                      </div>
                    )}
                    {template.show_certifications && (
                      <div className="mt-4">
                        <p className="font-semibold mb-2" style={{ color: template.label_color }}>Certifications:</p>
                        <div className="bg-muted/30 p-2 rounded text-xs" style={{ color: template.value_color }}>
                          • Forklift Operator<br />
                          • OSHA 10-Hour Safety
                        </div>
                      </div>
                    )}
                    {template.show_capabilities && (
                      <div className="mt-4">
                        <p className="font-semibold mb-2" style={{ color: template.label_color }}>Capabilities:</p>
                        <div className="bg-muted/30 p-2 rounded text-xs" style={{ color: template.value_color }}>
                          • Heavy Equipment<br />
                          • Welding
                        </div>
                      </div>
                    )}
                    {template.show_languages && (
                      <div className="mt-4">
                        <p className="font-semibold mb-2" style={{ color: template.label_color }}>Languages:</p>
                        <div className="bg-muted/30 p-2 rounded text-xs" style={{ color: template.value_color }}>
                          English, Spanish
                        </div>
                      </div>
                    )}
                    {template.custom_fields.length > 0 && (
                      <div className="mt-4 space-y-1">
                        {template.custom_fields.map((field, index) => (
                          <div key={index} className="flex justify-between py-1 border-b">
                            <span className="font-semibold" style={{ color: template.label_color }}>{field.label}:</span>
                            <span style={{ color: template.value_color }}>{field.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-2 bg-muted text-center text-xs" style={{ color: template.footer_color }}>
                  Must be worn visibly at all times
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}