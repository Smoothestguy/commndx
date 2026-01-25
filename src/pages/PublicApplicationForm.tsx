import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { MapPin, Calendar, Users, CheckCircle2, Loader2, Mail, AlertTriangle, Navigation, UserCheck, X } from "lucide-react";
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
import { useJobPostingByToken, useSubmitApplication } from "@/integrations/supabase/hooks/useStaffingApplications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FormField as FormFieldType, FormTheme, FormRow, CoreFieldsConfig, DEFAULT_CORE_FIELDS, FormSettings } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { AddressField, AddressValue } from "@/components/form-builder/AddressField";
import { FormattedPhoneInput } from "@/components/form-builder/FormattedPhoneInput";
import { LanguageSelector } from "@/components/form-builder/LanguageSelector";
import { useFormTranslation } from "@/hooks/useFormTranslation";
import { useGeolocation } from "@/hooks/useGeolocation";
import { cn } from "@/lib/utils";
import { SignaturePad } from "@/components/form-builder/SignaturePad";
import { FormFileUpload } from "@/components/form-builder/FormFileUpload";
import { useApplicantLookup, FoundApplicantData, LookupResult } from "@/hooks/useApplicantLookup";
import { SEO } from "@/components/SEO";

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
  photo_url: z.string().optional(),
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
  const [uploadingFields, setUploadingFields] = useState<Set<string>>(new Set());
  const [coreFields, setCoreFields] = useState<CoreFieldsConfig>(DEFAULT_CORE_FIELDS);
  const [formSettings, setFormSettings] = useState<FormSettings>({});
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [smsConsent, setSmsConsent] = useState(false);
  const [smsConsentError, setSmsConsentError] = useState<string | null>(null);
  
  // Returning applicant auto-fill state
  const [isReturningApplicant, setIsReturningApplicant] = useState(false);
  const [coreFieldsLocked, setCoreFieldsLocked] = useState(false);
  const [customFieldsLocked, setCustomFieldsLocked] = useState(false);
  const [lockedAnswerIds, setLockedAnswerIds] = useState<Set<string>>(new Set());
  const { lookupApplicant, isLookingUp, foundApplicant, clearApplicant } = useApplicantLookup();

  const { data: posting, isLoading, error } = useJobPostingByToken(token || "");
  const submitApplication = useSubmitApplication();
  
  // Geolocation hook - start capturing on mount
  const { geoData, isRequesting: isRequestingLocation, requestLocation, hasLocation } = useGeolocation(true);

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
          .select("fields, theme, success_message, settings")
          .eq("id", posting.form_template_id)
          .single();
        
        if (!error && template) {
          // Parse settings including core fields and requirements
          const settings = template.settings as unknown as FormSettings | null;
          if (settings) {
            setFormSettings(settings);
            if (settings.coreFields) {
              setCoreFields(settings.coreFields);
            }
          }
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
      photo_url: "",
    },
  });

  // Helper to check if answer is compatible with field options
  const isAnswerCompatible = (answer: any, field: FormFieldType): boolean => {
    if (field.type === "radio" || field.type === "dropdown") {
      // Check if the answer is one of the available options
      return field.options?.includes(answer) || false;
    }
    if (field.type === "multiselect") {
      // Check if all selected options exist in current field
      if (!Array.isArray(answer)) return false;
      return answer.every(opt => field.options?.includes(opt));
    }
    if (field.type === "checkbox") {
      return typeof answer === "boolean";
    }
    return true; // Other types are generally compatible
  };

  // Handle auto-fill when applicant is found
  const handleAutoFill = useCallback((lookupResult: LookupResult) => {
    const applicantData = lookupResult.applicant;
    if (!applicantData) return;
    
    // Fill core fields
    form.setValue("first_name", applicantData.first_name || "");
    form.setValue("last_name", applicantData.last_name || "");
    form.setValue("email", applicantData.email || "");
    form.setValue("phone", applicantData.phone || "");
    form.setValue("home_zip", applicantData.home_zip || "");
    if (applicantData.photo_url) {
      form.setValue("photo_url", applicantData.photo_url);
    }
    
    // Fill previous custom answers if available
    const prevAnswers = lookupResult.previousAnswers;
    const prevFields = lookupResult.previousFields;
    
    if (prevAnswers && Object.keys(prevAnswers).length > 0) {
      const answeredIds = new Set<string>();
      const mergedAnswers: Record<string, any> = {};
      
      // First pass: exact ID matches
      Object.entries(prevAnswers).forEach(([fieldId, value]) => {
        const currentField = customFields.find(f => f.id === fieldId);
        if (currentField) {
          const hasValue = value !== undefined && value !== null && value !== "" && 
            !(Array.isArray(value) && value.length === 0) &&
            !(typeof value === "object" && Object.keys(value).length === 0);
          
          // Check compatibility and exclude signature fields
          if (hasValue && currentField.type !== "signature" && isAnswerCompatible(value, currentField)) {
            mergedAnswers[fieldId] = value;
            answeredIds.add(fieldId);
          }
        }
      });
      
      // Second pass: smart matching by label similarity for unmatched current fields
      // This handles cases where a new form has similar questions with different IDs
      if (prevFields && prevFields.length > 0) {
        customFields.forEach(currentField => {
          // Skip if already matched or is a signature
          if (answeredIds.has(currentField.id) || currentField.type === "signature") return;
          
          // Find a previous field with similar label and same type
          const normalizeLabel = (label: string) => 
            label.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          const currentLabelNorm = normalizeLabel(currentField.label);
          
          for (const prevField of prevFields) {
            if (prevField.type !== currentField.type) continue;
            
            const prevLabelNorm = normalizeLabel(prevField.label);
            const prevAnswer = prevAnswers[prevField.id];
            
            // Check for exact label match or high similarity
            const isSimilar = currentLabelNorm === prevLabelNorm ||
              currentLabelNorm.includes(prevLabelNorm) ||
              prevLabelNorm.includes(currentLabelNorm);
            
            if (isSimilar && prevAnswer !== undefined) {
              const hasValue = prevAnswer !== null && prevAnswer !== "" && 
                !(Array.isArray(prevAnswer) && prevAnswer.length === 0) &&
                !(typeof prevAnswer === "object" && Object.keys(prevAnswer).length === 0);
              
              if (hasValue && isAnswerCompatible(prevAnswer, currentField)) {
                mergedAnswers[currentField.id] = prevAnswer;
                answeredIds.add(currentField.id);
                break; // Found a match, move to next field
              }
            }
          }
        });
      }
      
      setCustomAnswers(prev => ({ ...prev, ...mergedAnswers }));
      setLockedAnswerIds(answeredIds);
      setCustomFieldsLocked(answeredIds.size > 0);
    }
    
    // Pre-fill SMS consent if they've previously consented
    if (lookupResult.previousSmsConsent) {
      setSmsConsent(true);
    }
    
    setIsReturningApplicant(true);
    setCoreFieldsLocked(true);
    toast.success("Welcome back! We've pre-filled your information from your previous application.");
  }, [form, customFields]);

  // Handle email/phone lookup on blur
  const handleEmailBlur = useCallback(async (email: string) => {
    if (!email || !email.includes("@") || isReturningApplicant) return;
    
    const result = await lookupApplicant(email, undefined);
    if (result) {
      handleAutoFill(result);
    }
  }, [lookupApplicant, handleAutoFill, isReturningApplicant]);

  const handlePhoneBlur = useCallback(async (phone: string) => {
    if (!phone || isReturningApplicant) return;
    const normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.length !== 10) return;
    
    const result = await lookupApplicant(undefined, normalizedPhone);
    if (result) {
      handleAutoFill(result);
    }
  }, [lookupApplicant, handleAutoFill, isReturningApplicant]);

  // Clear auto-fill and allow editing
  const handleClearAutoFill = useCallback(() => {
    setIsReturningApplicant(false);
    setCoreFieldsLocked(false);
    setCustomFieldsLocked(false);
    setLockedAnswerIds(new Set());
    setSmsConsent(false);
    clearApplicant();
    form.reset();
    // Reset custom answers to defaults
    const defaults: Record<string, any> = {};
    customFields.forEach(field => {
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
    toast.info("You can now enter new information.");
  }, [clearApplicant, form, customFields]);

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

  const validateCustomFields = () => {
    console.log("[Validation] Starting validation of custom fields");
    console.log("[Validation] Custom answers:", customAnswers);
    
    for (const field of customFields) {
      if (field.required) {
        const value = customAnswers[field.id];
        console.log(`[Validation] Checking field ${field.id} (${field.type}):`, value);
        
        // Check for empty values
        if (value === undefined || value === "" || value === null) {
          toast.error(`${field.label} is required`);
          return false;
        }
        
        // Special validation for file fields - check for empty objects or non-URL strings
        if (field.type === "file") {
          const isEmptyObject = typeof value === "object" && Object.keys(value).length === 0;
          const isValidUrl = typeof value === "string" && value.startsWith("http");
          
          if (isEmptyObject || !isValidUrl) {
            console.error(`[Validation] File field ${field.id} has invalid value:`, value);
            toast.error(`Please upload a file for ${field.label}`);
            return false;
          }
          console.log(`[Validation] File field ${field.id} is valid URL:`, value);
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
    console.log("[Validation] All custom fields validated successfully");
    return true;
  };

  const onSubmit = async (data: z.infer<typeof baseSchema>) => {
    if (!posting) return;

    // Clear previous errors
    setPhotoError(null);
    setSmsConsentError(null);

    // Validate required profile photo
    const requiresPhoto = coreFields.profilePicture && (formSettings.requireProfilePhoto !== false);
    if (requiresPhoto && !data.photo_url) {
      setPhotoError("Profile photo is required");
      toast.error("Please upload a profile photo to submit your application");
      return;
    }

    // Validate required location
    if (formSettings.requireLocation && !hasLocation) {
      toast.error("Location access is required to submit this form. Please enable location services and try again.");
      return;
    }

    // Validate SMS consent if required
    if (formSettings.requireSmsConsent && !smsConsent) {
      setSmsConsentError("You must consent to SMS notifications to complete this application");
      toast.error("You must consent to SMS notifications to complete this application");
      return;
    }

    // Validate custom fields
    if (!validateCustomFields()) return;

    console.log("[Form] Submitting application with data:", data);
    console.log("[Form] Custom answers:", customAnswers);
    console.log("[Form] Geo data:", geoData);
    console.log("[Form] SMS consent:", smsConsent);

    try {
      // Extract address fields from customAnswers if present
      let extractedAddress = "";
      let extractedCity = "";
      let extractedState = "";
      let extractedZip = data.home_zip || "";

      for (const value of Object.values(customAnswers)) {
        if (typeof value === "object" && value !== null && "city" in value) {
          const addr = value as { street?: string; city?: string; state?: string; zip?: string };
          extractedAddress = addr.street || "";
          extractedCity = addr.city || "";
          extractedState = addr.state || "";
          extractedZip = extractedZip || addr.zip || "";
          break;
        }
      }

      await submitApplication.mutateAsync({
        posting_id: posting.id,
        applicant: {
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          address: extractedAddress || undefined,
          city: extractedCity || undefined,
          state: extractedState || undefined,
          home_zip: extractedZip || data.home_zip,
          photo_url: data.photo_url,
        },
        answers: customAnswers,
        geo: geoData,
        clientSubmittedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        smsConsent: smsConsent,
        smsConsentPhone: smsConsent ? data.phone : undefined,
        smsConsentTextVersion: smsConsent ? 'v1.0' : undefined,
      });
      console.log("[Form] Application submitted successfully");
      toast.success("Thank you for applying! We appreciate your interest and will review your application soon.");
      setSubmitted(true);
    } catch (err: any) {
      console.error("[Form] Application submission error:", err);
      
      if (err?.message === "DUPLICATE_APPLICATION") {
        toast.error("You have already applied for this specific position. You can still apply for other open positions.");
      } else if (err?.message?.includes("row-level security")) {
        toast.error("Permission error. Please contact support if this persists.");
        console.error("[Form] RLS policy error - check database policies");
      } else if (err?.code === "PGRST301") {
        toast.error("Database connection error. Please try again.");
      } else if (err?.code === "23505") {
        // This could be a unique constraint on applications (applicant_id + job_posting_id)
        // or on applicants (email) - but we handle applicant reuse now, so this is likely applications
        toast.error("You have already applied for this specific position.");
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
    const isFieldLocked = lockedAnswerIds.has(field.id);
    
    // Locked styling
    const lockedInputClass = isFieldLocked ? "bg-muted cursor-not-allowed opacity-70" : "";
    
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
              onChange={(e) => !isFieldLocked && updateCustomAnswer(field.id, e.target.value)}
              placeholder={translated.placeholder}
              readOnly={isFieldLocked}
              className={cn(lockedInputClass)}
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
                onChange={(e) => !isFieldLocked && updateCustomAnswer(field.id, e.target.value)}
                placeholder={translated.placeholder}
                readOnly={isFieldLocked}
                className={cn(field.showIcon !== false ? "pl-12 rounded-l-none" : "", lockedInputClass)}
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
                onChange={(v) => !isFieldLocked && updateCustomAnswer(field.id, v)}
                helpText={translated.helpText}
                showIcon={true}
                disabled={isFieldLocked}
                className={lockedInputClass}
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
                  onChange={(e) => !isFieldLocked && updateCustomAnswer(field.id, e.target.value.replace(/\D/g, ""))}
                  placeholder={translated.placeholder}
                  maxLength={10}
                  readOnly={isFieldLocked}
                  className={cn(lockedInputClass)}
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
              onChange={(v) => !isFieldLocked && updateCustomAnswer(field.id, v)}
              helpText={translated.helpText}
              disabled={isFieldLocked}
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
              onChange={(e) => !isFieldLocked && updateCustomAnswer(field.id, e.target.value)}
              placeholder={translated.placeholder}
              className={cn("min-h-[100px]", lockedInputClass)}
              readOnly={isFieldLocked}
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
              onChange={(e) => !isFieldLocked && updateCustomAnswer(field.id, e.target.value)}
              placeholder={translated.placeholder}
              readOnly={isFieldLocked}
              className={cn(lockedInputClass)}
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
              onValueChange={(v) => !isFieldLocked && updateCustomAnswer(field.id, v)}
              disabled={isFieldLocked}
            >
              <SelectTrigger className={cn(lockedInputClass)}>
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
          <div key={field.id} className={cn("space-y-2", isFieldLocked && "opacity-70 pointer-events-none")}>
            <FormLabel>
              {translated.label}
              {field.required && " *"}
            </FormLabel>
            <div className={optionGridClass}>
              {multiselectOptions.map((option) => (
                <div key={option} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedValues.includes(option)}
                    disabled={isFieldLocked}
                    onCheckedChange={(checked) => {
                      if (isFieldLocked) return;
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
          <div key={field.id} className={cn("flex flex-row items-start space-x-3 space-y-0", isFieldLocked && "opacity-70 pointer-events-none")}>
            <Checkbox
              checked={value || false}
              disabled={isFieldLocked}
              onCheckedChange={(checked) => !isFieldLocked && updateCustomAnswer(field.id, checked)}
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
          <div key={field.id} className={cn("space-y-2", isFieldLocked && "opacity-70 pointer-events-none")}>
            <FormLabel>
              {translated.label}
              {field.required && " *"}
            </FormLabel>
            <RadioGroup
              value={value || ""}
              onValueChange={(v) => !isFieldLocked && updateCustomAnswer(field.id, v)}
              className={optionGridClass}
              disabled={isFieldLocked}
            >
              {radioOptions.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.id}-${option}`} disabled={isFieldLocked} />
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
              onChange={(e) => !isFieldLocked && updateCustomAnswer(field.id, e.target.value)}
              readOnly={isFieldLocked}
              className={cn(lockedInputClass)}
            />
            {translated.helpText && <p className="text-xs text-muted-foreground">{translated.helpText}</p>}
          </div>
        );

      case "file":
        return (
          <div key={field.id}>
            <FormFileUpload
              value={value as string | null}
              onChange={(url) => !isFieldLocked && updateCustomAnswer(field.id, url)}
              onUploadStateChange={(isUploading) => handleFileUploadStateChange(field.id, isUploading)}
              label={translated.label}
              required={field.required}
              helpText={translated.helpText}
              acceptedFileTypes={field.acceptedFileTypes}
              maxFileSize={field.maxFileSize}
              storageBucket="application-files"
              storagePath="form-uploads"
              disabled={isFieldLocked}
            />
          </div>
        );

      case "signature":
        // Signature is NEVER locked - always allow signing
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
  // Detect mobile devices - iOS Safari has rendering bugs with background-attachment: fixed
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const getBackgroundStyle = () => {
    if (theme.backgroundImage) {
      return {
        backgroundImage: `url(${theme.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        // Use scroll on mobile to prevent black screen when camera/photo picker is triggered
        backgroundAttachment: isMobile ? "scroll" : "fixed",
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
    <>
      <SEO 
        title={`Apply - ${taskOrder.title}`}
        description={taskOrder.job_description?.slice(0, 160) || "Submit your job application"}
        image={theme.backgroundImage}
      />
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
        <Card 
          className={cn(theme.backgroundImage && "backdrop-blur-sm")}
          style={theme.backgroundImage ? { 
            backgroundColor: `hsl(var(--background) / ${(theme.cardOpacity ?? 90) / 100})` 
          } : undefined}
        >
          <CardHeader>
            <CardTitle className="text-xl">{taskOrder.title}</CardTitle>
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
        <Card 
          className={cn(theme.backgroundImage && "backdrop-blur-sm")}
          style={theme.backgroundImage ? { 
            backgroundColor: `hsl(var(--background) / ${(theme.cardOpacity ?? 90) / 100})` 
          } : undefined}
        >
          <CardHeader>
            <CardTitle>Apply for this Position</CardTitle>
            <CardDescription>Fill out the form below to submit your application</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Returning Applicant Welcome Banner */}
                {isReturningApplicant && foundApplicant && (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
                    <UserCheck className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-900 dark:text-green-100">
                      Welcome back, {foundApplicant.first_name}!
                    </AlertTitle>
                    <AlertDescription className="text-green-700 dark:text-green-300">
                      {customFieldsLocked 
                        ? "We've pre-filled all your information from your previous application. Just sign and submit!"
                        : "We've pre-filled your personal information from your previous application."
                      }
                      <Button 
                        type="button"
                        variant="link" 
                        className="p-0 h-auto text-green-700 dark:text-green-400 ml-2 underline"
                        onClick={handleClearAutoFill}
                      >
                        Use different information
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Lookup Loading Indicator */}
                {isLookingUp && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Checking for existing application...</span>
                  </div>
                )}

                {/* Location requirement notice */}
                {formSettings.requireLocation && !hasLocation && (
                  <Alert variant="default" className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                    <Navigation className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-900 dark:text-blue-100">Location Required</AlertTitle>
                    <AlertDescription className="text-blue-700 dark:text-blue-300">
                      {isRequestingLocation 
                        ? "Requesting your location..."
                        : geoData.error 
                          ? `${geoData.error}. Please enable location access to submit this form.`
                          : "Please allow location access when prompted to submit this form."
                      }
                      {geoData.error && (
                        <Button 
                          type="button"
                          variant="link" 
                          className="p-0 h-auto text-blue-600 dark:text-blue-400 ml-2"
                          onClick={requestLocation}
                        >
                          Try again
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Profile Picture - Core Field */}
                {coreFields.profilePicture && (
                  <div className="space-y-2">
                    <FormFileUpload
                      value={form.watch("photo_url") || null}
                      onChange={(url) => {
                        form.setValue("photo_url", url || "");
                        setPhotoError(null);
                      }}
                      onUploadStateChange={(isUploading) => handleFileUploadStateChange("core_photo", isUploading)}
                      label={`${getCoreLabel('profilePicture')}${formSettings.requireProfilePhoto !== false ? ' *' : ''}`}
                      required={formSettings.requireProfilePhoto !== false}
                      helpText={coreFieldsLocked && foundApplicant?.photo_url
                        ? "Using your existing photo from previous application"
                        : formSettings.requireProfilePhoto !== false 
                          ? "A clear photo is required for your application (max 10MB)" 
                          : "Upload a clear photo of yourself (optional)"
                      }
                      acceptedFileTypes={["image/jpeg", "image/jpg", "image/png", "image/heic"]}
                      maxFileSize={10}
                      storageBucket="application-files"
                      storagePath="profile-photos"
                      disabled={coreFieldsLocked && !!foundApplicant?.photo_url}
                    />
                    {photoError && (
                      <p className="text-sm font-medium text-destructive">{photoError}</p>
                    )}
                  </div>
                )}

                {/* Core Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {coreFields.firstName && (
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{getCoreLabel('firstName')} *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="John" 
                              {...field} 
                              readOnly={coreFieldsLocked}
                              className={cn(coreFieldsLocked && "bg-muted cursor-not-allowed opacity-70")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {coreFields.lastName && (
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{getCoreLabel('lastName')} *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Doe" 
                              {...field} 
                              readOnly={coreFieldsLocked}
                              className={cn(coreFieldsLocked && "bg-muted cursor-not-allowed opacity-70")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {coreFields.email && (
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{getCoreLabel('email')} *</FormLabel>
                          <FormControl>
                            <div className="relative flex items-center">
                              <div className={cn(
                                "absolute left-0 flex items-center justify-center w-10 h-full bg-muted border border-r-0 rounded-l-md",
                                coreFieldsLocked && "opacity-70"
                              )}>
                                {isLookingUp ? (
                                  <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                                ) : (
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <Input 
                                type="email" 
                                placeholder="john@example.com" 
                                className={cn(
                                  "pl-12 rounded-l-none",
                                  coreFieldsLocked && "bg-muted cursor-not-allowed opacity-70"
                                )}
                                {...field}
                                readOnly={coreFieldsLocked}
                                onBlur={(e) => {
                                  field.onBlur();
                                  if (!coreFieldsLocked) {
                                    handleEmailBlur(e.target.value);
                                  }
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {coreFields.phone && (
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
                              disabled={coreFieldsLocked}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {coreFields.homeZip && (
                  <FormField
                    control={form.control}
                    name="home_zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Home ZIP Code</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="12345" 
                            maxLength={10} 
                            className={cn(
                              "w-1/3 min-w-[120px]",
                              coreFieldsLocked && "bg-muted cursor-not-allowed opacity-70"
                            )}
                            {...field}
                            readOnly={coreFieldsLocked}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Custom Fields from Form Template */}
                {customFields.length > 0 && (
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-medium text-sm text-muted-foreground">Additional Questions</h3>
                    <div className="space-y-4">
                      {renderFieldsWithLayout(customFields, customLayout, renderCustomField)}
                    </div>
                  </div>
                )}

                {/* SMS Consent Checkbox - TCPA Compliant */}
                {formSettings.requireSmsConsent && (
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="sms-consent"
                        checked={smsConsent}
                        onCheckedChange={(checked) => {
                          setSmsConsent(checked === true);
                          if (checked) setSmsConsentError(null);
                        }}
                        className="mt-0.5"
                      />
                      <div className="space-y-2">
                      <Label htmlFor="sms-consent" className="text-sm leading-relaxed cursor-pointer">
                          I agree to receive SMS notifications about my contractor status, 
                          assignment updates, and payment information. Message frequency: up to 
                          3 messages per week. Msg & data rates may apply. *
                        </Label>
                        <div className="flex gap-3 text-xs">
                          {formSettings.privacyPolicyUrl && (
                            <a 
                              href={formSettings.privacyPolicyUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              Privacy Policy
                            </a>
                          )}
                          {formSettings.termsOfServiceUrl && (
                            <a 
                              href={formSettings.termsOfServiceUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              Terms of Service
                            </a>
                          )}
                        </div>
                        {smsConsentError && (
                          <p className="text-sm font-medium text-destructive">{smsConsentError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitApplication.isPending || isAnyFileUploading}
                  style={{
                    backgroundColor: theme.buttonColor || undefined,
                    color: theme.buttonTextColor || undefined,
                  }}
                >
                  {isAnyFileUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading files...
                    </>
                  ) : submitApplication.isPending ? (
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
    </>
  );
}
