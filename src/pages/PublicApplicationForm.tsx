import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { MapPin, Calendar, Users, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJobPostingByToken, useSubmitApplication } from "@/integrations/supabase/hooks/useStaffingApplications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FormField as FormFieldType, FormTheme, FormRow } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { AddressField, AddressValue } from "@/components/form-builder/AddressField";
import { FormattedPhoneInput } from "@/components/form-builder/FormattedPhoneInput";
import { LanguageSelector } from "@/components/form-builder/LanguageSelector";
import { useFormTranslation } from "@/hooks/useFormTranslation";
import { cn } from "@/lib/utils";
import { SignaturePad } from "@/components/form-builder/SignaturePad";
import { FormFileUpload } from "@/components/form-builder/FormFileUpload";

// Helper function to render fields based on layout
function renderFieldsWithLayout(
  fields: FormFieldType[], 
  layout: FormRow[] | undefined, 
  renderField: (field: FormFieldType) => React.ReactNode
) {
  // If we have a layout, use it
  if (layout && layout.length > 0) {
    const fieldMap = new Map(fields.map(f => [f.id, f]));
    
    return layout.map((row, rowIndex) => {
      const rowFields = row.fieldIds
        .map(id => fieldMap.get(id))
        .filter((f): f is FormFieldType => f !== undefined);
      
      if (rowFields.length === 0) return null;

      const gridClass = rowFields.length === 1 
        ? "grid-cols-1" 
        : rowFields.length === 2 
          ? "grid-cols-1 sm:grid-cols-2" 
          : "grid-cols-1 sm:grid-cols-3";

      return (
        <div key={row.id || rowIndex} className={cn("grid gap-4", gridClass)}>
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
// Base schema for core fields
const baseSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string()
    .min(1, "Phone number is required")
    .regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  home_zip: z.string().optional(),
});

export default function PublicApplicationForm() {
  const { token } = useParams<{ token: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [customFields, setCustomFields] = useState<FormFieldType[]>([]);
  const [customLayout, setCustomLayout] = useState<FormRow[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});
  const [theme, setTheme] = useState<FormTheme>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formTemplateId, setFormTemplateId] = useState<string | undefined>();

  const { data: posting, isLoading, error } = useJobPostingByToken(token || "");
  const submitApplication = useSubmitApplication();

  // Translation hook
  const {
    currentLanguage,
    changeLanguage,
    isTranslating,
    getCoreLabel,
    getCustomField,
    getUIText,
    supportedLanguages,
  } = useFormTranslation({
    formTemplateId,
    customFields,
    successMessage: successMessage || undefined,
  });

  // Fetch form template if the posting has one
  useEffect(() => {
    const fetchTemplate = async () => {
      if (posting?.form_template_id) {
        setFormTemplateId(posting.form_template_id);
        const { data: template, error } = await supabase
          .from("application_form_templates")
          .select("fields, theme, success_message")
          .eq("id", posting.form_template_id)
          .single();
        
        if (!error && template) {
          if (template.fields) {
            const fields = template.fields as unknown as FormFieldType[];
            setCustomFields(fields);
            
            // Generate layout from fields if not provided (each field gets its own row)
            const generatedLayout: FormRow[] = fields.map(f => ({
              id: `row_${f.id}`,
              fieldIds: [f.id]
            }));
            setCustomLayout(generatedLayout);
            
            // Initialize default values for custom fields
            const defaults: Record<string, any> = {};
            fields.forEach(field => {
              if (field.type === "checkbox") {
                defaults[field.id] = false;
              } else if (field.type === "multiselect") {
                defaults[field.id] = [];
              } else if (field.type === "address") {
                defaults[field.id] = { street: "", line2: "", city: "", state: "", zip: "" };
              } else if (field.type === "file") {
                defaults[field.id] = null;
              } else {
                defaults[field.id] = "";
              }
            });
            setCustomAnswers(defaults);
          }
          if (template.theme) {
            setTheme(template.theme as unknown as FormTheme);
          }
          if (template.success_message) {
            setSuccessMessage(template.success_message);
          }
        }
      }
    };
    
    if (posting) {
      fetchTemplate();
    }
  }, [posting]);

  const form = useForm({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      home_zip: "",
    },
  });

  const validateCustomFields = () => {
    for (const field of customFields) {
      if (field.required) {
        const value = customAnswers[field.id];
        if (value === undefined || value === "" || value === null) {
          toast.error(`${field.label} is required`);
          return false;
        }
        // Special validation for address
        if (field.type === "address" && typeof value === "object") {
          const addr = value as AddressValue;
          if (!addr.street || !addr.city || !addr.state || !addr.zip) {
            toast.error(`Please complete all required fields in ${field.label}`);
            return false;
          }
        }
        // Special validation for multiselect
        if (field.type === "multiselect" && Array.isArray(value) && value.length === 0) {
          toast.error(`${field.label} is required`);
          return false;
        }
      }
    }
    return true;
  };

  const onSubmit = async (data: z.infer<typeof baseSchema>) => {
    if (!posting) return;

    // Validate custom fields
    if (!validateCustomFields()) return;

    console.log("[Form] Submitting application with data:", data);
    console.log("[Form] Custom answers:", customAnswers);

    try {
      await submitApplication.mutateAsync({
        posting_id: posting.id,
        applicant: {
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          home_zip: data.home_zip,
        },
        answers: customAnswers,
      });
      console.log("[Form] Application submitted successfully");
      toast.success("Thank you for applying! We appreciate your interest and will review your application soon.");
      setSubmitted(true);
    } catch (err: any) {
      console.error("[Form] Application submission error:", err);
      
      if (err?.message === "DUPLICATE_APPLICATION") {
        toast.error("You have already applied for this position. Only one application per person is allowed.");
      } else if (err?.message?.includes("row-level security")) {
        toast.error("Permission error. Please contact support if this persists.");
        console.error("[Form] RLS policy error - check database policies");
      } else if (err?.code === "PGRST301") {
        toast.error("Database connection error. Please try again.");
      } else if (err?.code === "23505") {
        toast.error("This email has already been used. Please use a different email.");
      } else {
        toast.error(err?.message || "Failed to submit application. Please try again.");
      }
    }
  };

  const updateCustomAnswer = (fieldId: string, value: any) => {
    setCustomAnswers(prev => ({ ...prev, [fieldId]: value }));
  };

  const renderCustomField = (field: FormFieldType) => {
    const value = customAnswers[field.id];
    const translated = getCustomField(field.id);
    
    // Grid layout for options
    const optionGridClass = field.optionLayout === "grid" 
      ? "grid grid-cols-2 sm:grid-cols-3 gap-2" 
      : "space-y-2";

    switch (field.type) {
      case "section":
        return (
          <div key={field.id} className="pt-4 pb-2 border-b">
            <h3 className="text-lg font-semibold">{translated.label}</h3>
            {translated.helpText && (
              <p className="text-sm text-muted-foreground mt-1">{translated.helpText}</p>
            )}
          </div>
        );

      case "firstname":
      case "lastname":
      case "text":
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {translated.label}
              {field.required && " *"}
            </FormLabel>
            <Input
              value={value || ""}
              onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
              placeholder={translated.placeholder}
            />
            {translated.helpText && <p className="text-xs text-muted-foreground">{translated.helpText}</p>}
          </div>
        );

      case "email":
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {translated.label}
              {field.required && " *"}
            </FormLabel>
            <div className="relative flex items-center">
              {field.showIcon !== false && (
                <div className="absolute left-0 flex items-center justify-center w-10 h-full bg-muted border border-r-0 rounded-l-md">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <Input
                type="email"
                value={value || ""}
                onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
                placeholder={translated.placeholder}
                className={field.showIcon !== false ? "pl-12 rounded-l-none" : ""}
              />
            </div>
            {translated.helpText && <p className="text-xs text-muted-foreground">{translated.helpText}</p>}
          </div>
        );

      case "phone":
        return (
          <div key={field.id}>
            {field.showIcon !== false ? (
              <FormattedPhoneInput
                label={translated.label + (field.required ? " *" : "")}
                value={value || ""}
                onChange={(v) => updateCustomAnswer(field.id, v)}
                helpText={translated.helpText}
                showIcon={true}
              />
            ) : (
              <div className="space-y-2">
                <FormLabel>
                  {translated.label}
                  {field.required && " *"}
                </FormLabel>
                <Input
                  type="tel"
                  value={value || ""}
                  onChange={(e) => updateCustomAnswer(field.id, e.target.value.replace(/\D/g, ""))}
                  placeholder={translated.placeholder}
                  maxLength={10}
                />
                {translated.helpText && <p className="text-xs text-muted-foreground">{translated.helpText}</p>}
              </div>
            )}
          </div>
        );

      case "address":
        return (
          <div key={field.id}>
            <AddressField
              label={translated.label + (field.required ? " *" : "")}
              value={value as AddressValue}
              onChange={(v) => updateCustomAnswer(field.id, v)}
              helpText={translated.helpText}
            />
          </div>
        );

      case "textarea":
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {translated.label}
              {field.required && " *"}
            </FormLabel>
            <Textarea
              value={value || ""}
              onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
              placeholder={translated.placeholder}
              className="min-h-[100px]"
            />
            {translated.helpText && <p className="text-xs text-muted-foreground">{translated.helpText}</p>}
          </div>
        );

      case "number":
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {translated.label}
              {field.required && " *"}
            </FormLabel>
            <Input
              type="number"
              value={value || ""}
              onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
              placeholder={translated.placeholder}
            />
            {translated.helpText && <p className="text-xs text-muted-foreground">{translated.helpText}</p>}
          </div>
        );

      case "dropdown":
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {translated.label}
              {field.required && " *"}
            </FormLabel>
            <Select
              value={value || ""}
              onValueChange={(v) => updateCustomAnswer(field.id, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${translated.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {(translated.options || field.options)?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {translated.helpText && <p className="text-xs text-muted-foreground">{translated.helpText}</p>}
          </div>
        );

      case "multiselect":
        const selectedValues = Array.isArray(value) ? value : [];
        const multiselectOptions = translated.options || field.options || [];
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {translated.label}
              {field.required && " *"}
            </FormLabel>
            <div className={optionGridClass}>
              {multiselectOptions.map((option) => (
                <div key={option} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedValues.includes(option)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        updateCustomAnswer(field.id, [...selectedValues, option]);
                      } else {
                        updateCustomAnswer(field.id, selectedValues.filter((v: string) => v !== option));
                      }
                    }}
                  />
                  <Label className="font-normal text-sm">{option}</Label>
                </div>
              ))}
            </div>
            {translated.helpText && <p className="text-xs text-muted-foreground">{translated.helpText}</p>}
          </div>
        );

      case "checkbox":
        return (
          <div key={field.id} className="flex flex-row items-start space-x-3 space-y-0">
            <Checkbox
              checked={value || false}
              onCheckedChange={(checked) => updateCustomAnswer(field.id, checked)}
            />
            <div className="space-y-1 leading-none">
              <FormLabel>
                {translated.label}
                {field.required && " *"}
              </FormLabel>
              {translated.helpText && <p className="text-xs text-muted-foreground">{translated.helpText}</p>}
            </div>
          </div>
        );

      case "radio":
        const radioOptions = translated.options || field.options || [];
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {translated.label}
              {field.required && " *"}
            </FormLabel>
            <RadioGroup
              value={value || ""}
              onValueChange={(v) => updateCustomAnswer(field.id, v)}
              className={optionGridClass}
            >
              {radioOptions.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                  <FormLabel htmlFor={`${field.id}-${option}`} className="font-normal">
                    {option}
                  </FormLabel>
                </div>
              ))}
            </RadioGroup>
            {translated.helpText && <p className="text-xs text-muted-foreground">{translated.helpText}</p>}
          </div>
        );

      case "date":
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {translated.label}
              {field.required && " *"}
            </FormLabel>
            <Input
              type="date"
              value={value || ""}
              onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
            />
            {translated.helpText && <p className="text-xs text-muted-foreground">{translated.helpText}</p>}
          </div>
        );

      case "file":
        return (
          <div key={field.id}>
            <FormFileUpload
              value={value as string | null}
              onChange={(url) => updateCustomAnswer(field.id, url)}
              label={translated.label}
              required={field.required}
              helpText={translated.helpText}
              acceptedFileTypes={field.acceptedFileTypes}
              maxFileSize={field.maxFileSize}
              storageBucket="application-files"
              storagePath="form-uploads"
            />
          </div>
        );

      case "signature":
        return (
          <div key={field.id}>
            <SignaturePad
              value={value as string | undefined}
              onChange={(sig) => updateCustomAnswer(field.id, sig)}
              label={translated.label}
              required={field.required}
              helpText={translated.helpText}
            />
          </div>
        );

      default:
        return null;
    }
  };

  // Get background style from theme
  const getBackgroundStyle = () => {
    if (theme.backgroundImage) {
      return {
        backgroundImage: `url(${theme.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      };
    }
    if (theme.backgroundGradient) {
      return { background: theme.backgroundGradient };
    }
    if (theme.backgroundColor) {
      return { backgroundColor: theme.backgroundColor };
    }
    return {};
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !posting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Position Unavailable</CardTitle>
            <CardDescription>
              This job posting is no longer accepting applications or does not exist.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          ...getBackgroundStyle(),
          fontFamily: theme.fontFamily || "inherit",
        }}
      >
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle>Application Received!</CardTitle>
            <CardDescription>
              {successMessage || "Thank you for applying. We will review your application and contact you if you're selected."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const taskOrder = posting.project_task_orders;
  const hasTheme = theme.backgroundImage || theme.backgroundGradient || theme.backgroundColor;

  return (
    <div 
      className={cn("min-h-screen py-8 px-4", !hasTheme && "bg-muted/30")}
      style={{
        ...getBackgroundStyle(),
        fontFamily: theme.fontFamily || "inherit",
      }}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Language Selector */}
        <div className="flex justify-end">
          <LanguageSelector
            currentLanguage={currentLanguage}
            onLanguageChange={changeLanguage}
            isTranslating={isTranslating}
          />
        </div>

        {/* Job Info Card */}
        <Card className={cn(theme.backgroundImage && "bg-background/95 backdrop-blur-sm")}>
          <CardHeader>
            <CardTitle className="text-xl">{taskOrder.title}</CardTitle>
            <CardDescription>{taskOrder.projects?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {taskOrder.job_description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {taskOrder.job_description}
              </p>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              {taskOrder.location_address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{taskOrder.location_address}</span>
                </div>
              )}
              {taskOrder.start_at && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Starts {format(new Date(taskOrder.start_at), "MMM d, yyyy")}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{taskOrder.headcount_needed} position(s) available</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Application Form */}
        <Card className={cn(theme.backgroundImage && "bg-background/95 backdrop-blur-sm")}>
          <CardHeader>
            <CardTitle>Apply for this Position</CardTitle>
            <CardDescription>Fill out the form below to submit your application</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Core Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{getCoreLabel('firstName')} *</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{getCoreLabel('lastName')} *</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{getCoreLabel('email')} *</FormLabel>
                        <FormControl>
                          <div className="relative flex items-center">
                            <div className="absolute left-0 flex items-center justify-center w-10 h-full bg-muted border border-r-0 rounded-l-md">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <Input 
                              type="email" 
                              placeholder="john@example.com" 
                              className="pl-12 rounded-l-none" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <FormattedPhoneInput
                            label="Phone *"
                            value={field.value}
                            onChange={field.onChange}
                            showIcon
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="home_zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home ZIP Code</FormLabel>
                      <FormControl>
                        <Input placeholder="12345" maxLength={10} className="w-1/3 min-w-[120px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Custom Fields from Form Template */}
                {customFields.length > 0 && (
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-medium text-sm text-muted-foreground">Additional Questions</h3>
                    <div className="space-y-4">
                      {renderFieldsWithLayout(customFields, customLayout, renderCustomField)}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitApplication.isPending}
                  style={{
                    backgroundColor: theme.buttonColor || undefined,
                    color: theme.buttonTextColor || undefined,
                  }}
                >
                  {submitApplication.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    theme.buttonText || "Submit Application"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
