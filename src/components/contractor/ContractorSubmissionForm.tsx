import React, { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FileUploadZone, UploadedFile } from "./FileUploadZone";
import { FormField, useFormConfiguration, useCreateContractorSubmission, uploadContractorFile } from "@/integrations/supabase/hooks/useContractorSubmissions";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { toast } from "sonner";
import { Language, getTranslation, getFieldLabel } from "./translations";

interface ContractorSubmissionFormProps {
  formType: "bill" | "expense";
  onSuccess: () => void;
  language: Language;
}

export function ContractorSubmissionForm({ formType, onSuccess, language }: ContractorSubmissionFormProps) {
  const { data: formConfig, isLoading: configLoading } = useFormConfiguration(formType);
  const { data: projects } = useProjects();
  const createSubmission = useCreateContractorSubmission();

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(language, key);

  const updateField = (name: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formConfig) return;

    // Validate required fields
    for (const field of formConfig.fields) {
      if (field.required) {
        const fieldLabel = getFieldLabel(language, field.name, field.label);
        if (field.type === "file_upload") {
          if (files.length === 0) {
            toast.error(`${fieldLabel} ${t("isRequired")}`);
            return;
          }
        } else if (!formData[field.name]) {
          toast.error(`${fieldLabel} ${t("isRequired")}`);
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const contractorName = formData.contractor_name as string || "Unknown";
      const submissionDate = formData.submission_date 
        ? format(formData.submission_date as Date, "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd");

      // Upload files first
      const uploadedFiles = await Promise.all(
        files.map(f => uploadContractorFile(f.file, formType, contractorName, submissionDate))
      );

      // Create submission
      await createSubmission.mutateAsync({
        submission_type: formType,
        contractor_name: contractorName,
        job_name: (formData.job_name as string) || null,
        customer_name: (formData.customer_name as string) || null,
        project_name: (formData.project_name as string) || null,
        expense_description: (formData.expense_description as string) || null,
        amount: formData.amount ? Number(formData.amount) : null,
        submission_date: submissionDate,
        files: uploadedFiles,
        custom_fields: formData,
      });

      toast.success(t("submissionSuccess"));
      onSuccess();
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(t("submissionError"));
    } finally {
      setSubmitting(false);
    }
  };

  const getPlaceholder = (field: FormField): string => {
    if (field.placeholder) return field.placeholder;
    
    switch (field.name) {
      case "contractor_name":
        return t("enterYourName");
      case "customer_name":
        return t("selectCustomer");
      case "project_name":
      case "job_name":
        return t("selectProject");
      case "expense_description":
        return t("enterDescription");
      case "submission_date":
        return t("selectDate");
      default:
        return "";
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name];
    const placeholder = getPlaceholder(field);

    switch (field.type) {
      case "text":
        return (
          <Input
            placeholder={placeholder}
            value={(value as string) || ""}
            onChange={(e) => updateField(field.name, e.target.value)}
          />
        );

      case "textarea":
        return (
          <Textarea
            placeholder={placeholder}
            value={(value as string) || ""}
            onChange={(e) => updateField(field.name, e.target.value)}
            rows={4}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            placeholder={placeholder || "0"}
            value={(value as string) || ""}
            onChange={(e) => updateField(field.name, e.target.value)}
          />
        );

      case "currency":
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={(value as string) || ""}
              onChange={(e) => updateField(field.name, e.target.value)}
              className="pl-7"
            />
          </div>
        );

      case "date":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !value && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(value as Date, "PPP") : t("selectDate")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value as Date | undefined}
                onSelect={(date) => updateField(field.name, date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        );

      case "dropdown":
        return (
          <Select
            value={(value as string) || ""}
            onValueChange={(v) => updateField(field.name, v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "project_select":
        return (
          <Select
            value={(value as string) || ""}
            onValueChange={(v) => updateField(field.name, v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("selectProject")} />
            </SelectTrigger>
            <SelectContent>
              {projects?.map((project) => (
                <SelectItem key={project.id} value={project.name}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "customer_select":
        return (
          <div className="flex gap-2">
            <Input
              placeholder={t("typeCustomerName")}
              value={(value as string) || ""}
              onChange={(e) => updateField(field.name, e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => updateField(field.name, t("other"))}
              className="shrink-0"
            >
              {t("other")}
            </Button>
          </div>
        );

      case "file_upload":
        return (
          <FileUploadZone
            files={files}
            onFilesChange={setFiles}
            label=""
            required={field.required}
          />
        );

      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.name}
              checked={(value as boolean) || false}
              onCheckedChange={(checked) => updateField(field.name, checked)}
            />
            <label htmlFor={field.name} className="text-sm">
              {field.placeholder || getFieldLabel(language, field.name, field.label)}
            </label>
          </div>
        );

      case "radio":
        return (
          <RadioGroup
            value={(value as string) || ""}
            onValueChange={(v) => updateField(field.name, v)}
          >
            {field.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${field.name}-${option}`} />
                <Label htmlFor={`${field.name}-${option}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      default:
        return (
          <Input
            value={(value as string) || ""}
            onChange={(e) => updateField(field.name, e.target.value)}
          />
        );
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!formConfig) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t("formNotFound")}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formConfig.fields.map((field) => (
        <div key={field.id} className="space-y-2">
          {field.type !== "checkbox" && (
            <Label>
              {getFieldLabel(language, field.name, field.label)}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
          )}
          {renderField(field)}
        </div>
      ))}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("submitting")}
          </>
        ) : (
          formType === "bill" ? t("submitBillButton") : t("submitExpenseButton")
        )}
      </Button>
    </form>
  );
}
