import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { MapPin, Calendar, Users, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

interface FormFieldConfig {
  id: string;
  type: "text" | "textarea" | "number" | "dropdown" | "checkbox" | "radio" | "date";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

// Base schema for core fields
const baseSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  home_zip: z.string().optional(),
});

export default function PublicApplicationForm() {
  const { token } = useParams<{ token: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [customFields, setCustomFields] = useState<FormFieldConfig[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});

  const { data: posting, isLoading, error } = useJobPostingByToken(token || "");
  const submitApplication = useSubmitApplication();

  // Fetch form template if the posting has one
  useEffect(() => {
    const fetchTemplate = async () => {
      if (posting?.form_template_id) {
        const { data: template, error } = await supabase
          .from("application_form_templates")
          .select("fields")
          .eq("id", posting.form_template_id)
          .single();
        
        if (!error && template?.fields) {
          setCustomFields(template.fields as unknown as FormFieldConfig[]);
          // Initialize default values for custom fields
          const defaults: Record<string, any> = {};
          (template.fields as unknown as FormFieldConfig[]).forEach(field => {
            if (field.type === "checkbox") {
              defaults[field.id] = false;
            } else {
              defaults[field.id] = "";
            }
          });
          setCustomAnswers(defaults);
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
      }
    }
    return true;
  };

  const onSubmit = async (data: z.infer<typeof baseSchema>) => {
    if (!posting) return;

    // Validate custom fields
    if (!validateCustomFields()) return;

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
      toast.success("Thank you for applying! We appreciate your interest and will review your application soon.");
      setSubmitted(true);
    } catch (err: any) {
      console.error("Application submission error:", err);
      if (err?.message === "DUPLICATE_APPLICATION") {
        toast.error("You have already applied for this position. Only one application per person is allowed.");
      } else {
        toast.error("Failed to submit application. Please try again.");
      }
    }
  };

  const updateCustomAnswer = (fieldId: string, value: any) => {
    setCustomAnswers(prev => ({ ...prev, [fieldId]: value }));
  };

  const renderCustomField = (field: FormFieldConfig) => {
    const value = customAnswers[field.id];

    switch (field.type) {
      case "text":
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {field.label}
              {field.required && " *"}
            </FormLabel>
            <Input
              value={value || ""}
              onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
              placeholder={field.placeholder}
            />
          </div>
        );

      case "textarea":
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {field.label}
              {field.required && " *"}
            </FormLabel>
            <Textarea
              value={value || ""}
              onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
              placeholder={field.placeholder}
              className="min-h-[100px]"
            />
          </div>
        );

      case "number":
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {field.label}
              {field.required && " *"}
            </FormLabel>
            <Input
              type="number"
              value={value || ""}
              onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
              placeholder={field.placeholder}
            />
          </div>
        );

      case "dropdown":
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {field.label}
              {field.required && " *"}
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
                {field.label}
                {field.required && " *"}
              </FormLabel>
            </div>
          </div>
        );

      case "radio":
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {field.label}
              {field.required && " *"}
            </FormLabel>
            <RadioGroup
              value={value || ""}
              onValueChange={(v) => updateCustomAnswer(field.id, v)}
            >
              {field.options?.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                  <FormLabel htmlFor={`${field.id}-${option}`} className="font-normal">
                    {option}
                  </FormLabel>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case "date":
        return (
          <div key={field.id} className="space-y-2">
            <FormLabel>
              {field.label}
              {field.required && " *"}
            </FormLabel>
            <Input
              type="date"
              value={value || ""}
              onChange={(e) => updateCustomAnswer(field.id, e.target.value)}
            />
          </div>
        );

      default:
        return null;
    }
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
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle>Application Received!</CardTitle>
            <CardDescription>
              Thank you for applying. We will review your application and contact you if you're selected.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const taskOrder = posting.project_task_orders;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Job Info Card */}
        <Card>
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
        <Card>
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
                        <FormLabel>First Name *</FormLabel>
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
                        <FormLabel>Last Name *</FormLabel>
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
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
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
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="(555) 123-4567" {...field} />
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
                        <Input placeholder="12345" maxLength={10} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Custom Fields from Form Template */}
                {customFields.length > 0 && (
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-medium text-sm text-muted-foreground">Additional Questions</h3>
                    {customFields.map(renderCustomField)}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitApplication.isPending}
                >
                  {submitApplication.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Application"
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
