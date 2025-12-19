import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertTriangle, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FormField as FormFieldType, FormTheme, CoreFieldsConfig, DEFAULT_CORE_FIELDS } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { AddressField, AddressValue } from "@/components/form-builder/AddressField";
import { FormattedPhoneInput } from "@/components/form-builder/FormattedPhoneInput";
import { LanguageSelector } from "@/components/form-builder/LanguageSelector";
import { SignaturePad } from "@/components/form-builder/SignaturePad";
import { FormFileUpload } from "@/components/form-builder/FormFileUpload";
import { cn } from "@/lib/utils";

// Base schema for core fields
const baseSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string()
    .min(1, "Phone number is required")
    .regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  home_zip: z.string().optional(),
  photo_url: z.string().optional(),
});

interface ApplicationData {
  id: string;
  applicant_id: string;
  answers: Record<string, unknown>;
  status: string;
  missing_fields: string[];
  admin_message: string | null;
  edit_token: string;
  edit_token_expires_at: string;
  applicants: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    home_zip: string | null;
    photo_url: string | null;
  };
  job_postings: {
    form_template_id: string | null;
    project_task_orders: {
      title: string;
      projects: { name: string };
    };
  };
}

export default function EditApplication() {
  const { editToken } = useParams<{ editToken: string }>();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [customFields, setCustomFields] = useState<FormFieldType[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});
  const [theme, setTheme] = useState<FormTheme>({});
  const [coreFields, setCoreFields] = useState<CoreFieldsConfig>(DEFAULT_CORE_FIELDS);
  const [uploadingFields, setUploadingFields] = useState<Set<string>>(new Set());
  const [missingFieldLabels, setMissingFieldLabels] = useState<string[]>([]);

  const form = useForm({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      home_zip: "",
      photo_url: "",
    },
  });

  // Fetch application by edit token
  useEffect(() => {
    const fetchApplication = async () => {
      if (!editToken) {
        setError("Invalid edit link");
        setIsLoading(false);
        return;
      }

      try {
        // Fetch application by edit token
        const { data: app, error: fetchError } = await supabase
          .from("applications")
          .select(`
            id,
            applicant_id,
            answers,
            status,
            missing_fields,
            admin_message,
            edit_token,
            edit_token_expires_at,
            applicants (
              id,
              first_name,
              last_name,
              email,
              phone,
              home_zip,
              photo_url
            ),
            job_postings (
              form_template_id,
              project_task_orders (
                title,
                projects:project_id (name)
              )
            )
          `)
          .eq("edit_token", editToken)
          .single();

        if (fetchError || !app) {
          setError("This edit link is invalid or has expired");
          setIsLoading(false);
          return;
        }

        // Check if token has expired
        if (app.edit_token_expires_at) {
          const expiresAt = new Date(app.edit_token_expires_at);
          if (expiresAt < new Date()) {
            setError("This edit link has expired. Please contact the administrator for a new link.");
            setIsLoading(false);
            return;
          }
        }

        setApplication(app as unknown as ApplicationData);
        
        // Set missing field labels
        const missing = (app.missing_fields || []) as string[];
        setMissingFieldLabels(missing);

        // Pre-fill form with applicant data
        const applicant = app.applicants as ApplicationData["applicants"];
        form.reset({
          first_name: applicant.first_name || "",
          last_name: applicant.last_name || "",
          email: applicant.email || "",
          phone: applicant.phone || "",
          home_zip: applicant.home_zip || "",
          photo_url: applicant.photo_url || "",
        });

        // Pre-fill custom answers
        const answers = (app.answers || {}) as Record<string, any>;
        setCustomAnswers(answers);

        // Fetch form template if exists
        const templateId = (app.job_postings as any)?.form_template_id;
        if (templateId) {
          const { data: template } = await supabase
            .from("application_form_templates")
            .select("fields, theme, settings")
            .eq("id", templateId)
            .single();

          if (template) {
            const settings = template.settings as unknown as { coreFields?: CoreFieldsConfig } | null;
            if (settings?.coreFields) {
              setCoreFields(settings.coreFields);
            }
            if (template.fields) {
              setCustomFields(template.fields as unknown as FormFieldType[]);
            }
            if (template.theme) {
              setTheme(template.theme as unknown as FormTheme);
            }
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching application:", err);
        setError("Failed to load application. Please try again.");
        setIsLoading(false);
      }
    };

    fetchApplication();
  }, [editToken, form]);

  const handleFileUploadStateChange = useCallback((fieldId: string, isUploading: boolean) => {
    setUploadingFields(prev => {
      const next = new Set(prev);
      if (isUploading) {
        next.add(fieldId);
      } else {
        next.delete(fieldId);
      }
      return next;
    });
  }, []);

  const isAnyFileUploading = uploadingFields.size > 0;

  const updateCustomAnswer = (fieldId: string, value: any) => {
    setCustomAnswers(prev => ({ ...prev, [fieldId]: value }));
  };

  const isMissingField = (label: string) => {
    return missingFieldLabels.some(
      (f) => f.toLowerCase() === label.toLowerCase()
    );
  };

  const onSubmit = async (data: z.infer<typeof baseSchema>) => {
    if (!application) return;

    setIsSubmitting(true);

    try {
      // Get next revision number
      const { data: revisions } = await supabase
        .from("application_revisions")
        .select("revision_number")
        .eq("application_id", application.id)
        .order("revision_number", { ascending: false })
        .limit(1);

      const nextRevisionNumber = revisions && revisions.length > 0 
        ? revisions[0].revision_number + 1 
        : 1;

      // Create revision (snapshot of previous data)
      const { error: revisionError } = await supabase
        .from("application_revisions")
        .insert([{
          application_id: application.id,
          revision_number: nextRevisionNumber,
          previous_answers: application.answers as any,
          previous_applicant_data: {
            first_name: application.applicants.first_name,
            last_name: application.applicants.last_name,
            email: application.applicants.email,
            phone: application.applicants.phone,
            home_zip: application.applicants.home_zip,
            photo_url: application.applicants.photo_url,
          } as any,
          changed_by: "applicant",
        }]);

      if (revisionError) {
        console.error("Error creating revision:", revisionError);
        // Continue anyway - revision is nice to have
      }

      // Check if email changed and if it conflicts with another applicant
      if (data.email !== application.applicants.email) {
        const { data: existingApplicant } = await supabase
          .from("applicants")
          .select("id")
          .eq("email", data.email)
          .neq("id", application.applicant_id)
          .maybeSingle();

        if (existingApplicant) {
          toast.error("This email is already used by another applicant");
          setIsSubmitting(false);
          return;
        }
      }

      // Update applicant
      const { error: applicantError } = await supabase
        .from("applicants")
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          home_zip: data.home_zip || null,
          photo_url: data.photo_url || null,
        })
        .eq("id", application.applicant_id);

      if (applicantError) {
        console.error("Error updating applicant:", applicantError);
        throw applicantError;
      }

      // Process answers
      const processedAnswers: Record<string, unknown> = {};
      for (const [fieldId, value] of Object.entries(customAnswers)) {
        if (typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) {
          continue;
        }
        processedAnswers[fieldId] = value;
      }

      // Update application
      const { error: appError } = await supabase
        .from("applications")
        .update({
          answers: processedAnswers as any,
          status: "updated" as const,
          edit_token: null, // Clear token after use (one-time)
          edit_token_expires_at: null,
          missing_fields: [] as any,
          admin_message: null,
        })
        .eq("id", application.id);

      if (appError) {
        console.error("Error updating application:", appError);
        throw appError;
      }

      toast.success("Your application has been updated!");
      setSubmitted(true);
    } catch (err: any) {
      console.error("Error submitting edit:", err);
      toast.error(err.message || "Failed to update application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCustomField = (field: FormFieldType) => {
    const value = customAnswers[field.id];
    const isMissing = isMissingField(field.label);

    const wrapperClass = cn(
      "space-y-2",
      isMissing && "ring-2 ring-orange-400 ring-offset-2 rounded-md p-2 bg-orange-50 dark:bg-orange-950/20"
    );

    switch (field.type) {
      case "section":
        return (
          <div key={field.id} className="pt-4 pb-2 border-b">
            <h3 className="text-lg font-semibold">{field.label}</h3>
            {field.helpText && (
              <p className="text-sm text-muted-foreground mt-1">{field.helpText}</p>
            )}
          </div>
        );

      case "text":
      case "firstname":
      case "lastname":
        return (
          <div key={field.id} className={wrapperClass}>
            <FormLabel>
              {field.label}
              {field.required && " *"}
              {isMissing && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
            </FormLabel>
            <Input
              value={value || ""}
              onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
              placeholder={field.placeholder}
            />
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
          </div>
        );

      case "email":
        return (
          <div key={field.id} className={wrapperClass}>
            <FormLabel>
              {field.label}
              {field.required && " *"}
              {isMissing && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
            </FormLabel>
            <Input
              type="email"
              value={value || ""}
              onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
              placeholder={field.placeholder}
            />
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
          </div>
        );

      case "phone":
        return (
          <div key={field.id} className={wrapperClass}>
            <FormattedPhoneInput
              label={field.label + (field.required ? " *" : "") + (isMissing ? " (Please update)" : "")}
              value={value || ""}
              onChange={(v) => updateCustomAnswer(field.id, v)}
              helpText={field.helpText}
            />
          </div>
        );

      case "textarea":
        return (
          <div key={field.id} className={wrapperClass}>
            <FormLabel>
              {field.label}
              {field.required && " *"}
              {isMissing && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
            </FormLabel>
            <Textarea
              value={value || ""}
              onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
              placeholder={field.placeholder}
              className="min-h-[100px]"
            />
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
          </div>
        );

      case "number":
        return (
          <div key={field.id} className={wrapperClass}>
            <FormLabel>
              {field.label}
              {field.required && " *"}
              {isMissing && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
            </FormLabel>
            <Input
              type="number"
              value={value || ""}
              onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
              placeholder={field.placeholder}
            />
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
          </div>
        );

      case "dropdown":
        return (
          <div key={field.id} className={wrapperClass}>
            <FormLabel>
              {field.label}
              {field.required && " *"}
              {isMissing && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
            </FormLabel>
            <Select
              value={value || ""}
              onValueChange={(v) => updateCustomAnswer(field.id, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
          </div>
        );

      case "multiselect":
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div key={field.id} className={wrapperClass}>
            <FormLabel>
              {field.label}
              {field.required && " *"}
              {isMissing && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
            </FormLabel>
            <div className="space-y-2">
              {field.options?.map((option) => (
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
                  <span className="text-sm">{option}</span>
                </div>
              ))}
            </div>
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
          </div>
        );

      case "radio":
        return (
          <div key={field.id} className={wrapperClass}>
            <FormLabel>
              {field.label}
              {field.required && " *"}
              {isMissing && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
            </FormLabel>
            <RadioGroup
              value={value || ""}
              onValueChange={(v) => updateCustomAnswer(field.id, v)}
            >
              {field.options?.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                  <Label htmlFor={`${field.id}-${option}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
          </div>
        );

      case "checkbox":
        return (
          <div key={field.id} className={cn("flex items-start gap-2", isMissing && "ring-2 ring-orange-400 ring-offset-2 rounded-md p-2 bg-orange-50 dark:bg-orange-950/20")}>
            <Checkbox
              checked={value || false}
              onCheckedChange={(checked) => updateCustomAnswer(field.id, checked)}
            />
            <div className="grid gap-1.5 leading-none">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {field.label}
                {field.required && " *"}
                {isMissing && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
              </label>
              {field.helpText && (
                <p className="text-xs text-muted-foreground">{field.helpText}</p>
              )}
            </div>
          </div>
        );

      case "address":
        return (
          <div key={field.id} className={wrapperClass}>
            <AddressField
              label={field.label + (field.required ? " *" : "") + (isMissing ? " (Please update)" : "")}
              value={value as AddressValue}
              onChange={(v) => updateCustomAnswer(field.id, v)}
              helpText={field.helpText}
            />
          </div>
        );

      case "file":
        return (
          <div key={field.id} className={wrapperClass}>
            <FormFileUpload
              label={field.label + (field.required ? " *" : "") + (isMissing ? " (Please update)" : "")}
              value={typeof value === "string" ? value : ""}
              onChange={(url) => updateCustomAnswer(field.id, url)}
              helpText={field.helpText}
              onUploadStateChange={(isUploading) => handleFileUploadStateChange(field.id, isUploading)}
            />
          </div>
        );

      case "signature":
        return (
          <div key={field.id} className={wrapperClass}>
            <SignaturePad
              label={field.label + (field.required ? " *" : "") + (isMissing ? " (Please update)" : "")}
              value={typeof value === "string" ? value : ""}
              onChange={(v) => updateCustomAnswer(field.id, v)}
              helpText={field.helpText}
            />
          </div>
        );

      case "date":
        return (
          <div key={field.id} className={wrapperClass}>
            <FormLabel>
              {field.label}
              {field.required && " *"}
              {isMissing && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
            </FormLabel>
            <Input
              type="date"
              value={value || ""}
              onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
              placeholder={field.placeholder}
            />
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading your application...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Unable to Load Application</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Application Updated!</CardTitle>
            <CardDescription>
              Thank you for updating your application. We'll review your changes and be in touch soon.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const positionTitle = application?.job_postings?.project_task_orders?.title || "Position";
  const projectName = application?.job_postings?.project_task_orders?.projects?.name || "";

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Update Your Application</CardTitle>
            <CardDescription>
              {positionTitle}{projectName && ` • ${projectName}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Admin Message */}
            {application?.admin_message && (
              <Alert variant="default" className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-800 dark:text-orange-200">Message from reviewer</AlertTitle>
                <AlertDescription className="text-orange-700 dark:text-orange-300">
                  {application.admin_message}
                </AlertDescription>
              </Alert>
            )}

            {/* Missing Fields Notice */}
            {missingFieldLabels.length > 0 && (
              <Alert variant="default" className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-800 dark:text-orange-200">Please update the following fields:</AlertTitle>
                <AlertDescription className="text-orange-700 dark:text-orange-300">
                  <ul className="list-disc list-inside mt-2">
                    {missingFieldLabels.map((label, idx) => (
                      <li key={idx}>{label}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Core Fields */}
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">Personal Information</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem className={cn(isMissingField("First Name") && "ring-2 ring-orange-400 ring-offset-2 rounded-md p-2 bg-orange-50 dark:bg-orange-950/20")}>
                          <FormLabel>
                            First Name *
                            {isMissingField("First Name") && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem className={cn(isMissingField("Last Name") && "ring-2 ring-orange-400 ring-offset-2 rounded-md p-2 bg-orange-50 dark:bg-orange-950/20")}>
                          <FormLabel>
                            Last Name *
                            {isMissingField("Last Name") && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className={cn(isMissingField("Email") && "ring-2 ring-orange-400 ring-offset-2 rounded-md p-2 bg-orange-50 dark:bg-orange-950/20")}>
                        <FormLabel>
                          Email *
                          {isMissingField("Email") && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
                        </FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className={cn(isMissingField("Phone") && "ring-2 ring-orange-400 ring-offset-2 rounded-md p-2 bg-orange-50 dark:bg-orange-950/20")}>
                        <FormLabel>
                          Phone *
                          {isMissingField("Phone") && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                            maxLength={10}
                            placeholder="1234567890"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {coreFields.homeZip && (
                    <FormField
                      control={form.control}
                      name="home_zip"
                      render={({ field }) => (
                        <FormItem className={cn(isMissingField("Home ZIP Code") && "ring-2 ring-orange-400 ring-offset-2 rounded-md p-2 bg-orange-50 dark:bg-orange-950/20")}>
                          <FormLabel>
                            Home ZIP Code
                            {isMissingField("Home ZIP Code") && <span className="ml-2 text-orange-600 text-xs">(Please update)</span>}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} maxLength={10} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {coreFields.profilePicture && (
                    <div className={cn(
                      "space-y-2",
                      isMissingField("Profile Photo") && "ring-2 ring-orange-400 ring-offset-2 rounded-md p-2 bg-orange-50 dark:bg-orange-950/20"
                    )}>
                      <FormFileUpload
                        value={form.watch("photo_url") || null}
                        onChange={(url) => form.setValue("photo_url", url || "")}
                        onUploadStateChange={(isUploading) => handleFileUploadStateChange("core_photo", isUploading)}
                        label={`Profile Photo${isMissingField("Profile Photo") ? " (Please update)" : ""}`}
                        required={false}
                        helpText="Upload a clear photo of yourself"
                        acceptedFileTypes={["image/*"]}
                        maxFileSize={5}
                        storageBucket="application-files"
                        storagePath="profile-photos"
                      />
                    </div>
                  )}
                </div>

                {/* Custom Fields */}
                {customFields.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground">Additional Information</h3>
                    {customFields.map((field) => renderCustomField(field))}
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || isAnyFileUploading}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : isAnyFileUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading files...
                    </>
                  ) : (
                    "Update Application"
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
