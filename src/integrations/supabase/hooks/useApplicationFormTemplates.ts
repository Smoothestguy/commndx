import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Conditional logic types
export interface FieldCondition {
  fieldId: string;
  operator: "equals" | "notEquals" | "contains" | "isEmpty" | "isNotEmpty";
  value: string;
}

export interface ConditionalLogic {
  enabled: boolean;
  action: "show" | "hide";
  conditions: FieldCondition[];
  logicType: "all" | "any";
}

// Row layout structure for auto-arranging grid
export interface FormRow {
  id: string;
  fieldIds: string[];
}

// Enhanced form field with all new properties
export interface FormField {
  id: string;
  type: "text" | "textarea" | "number" | "dropdown" | "checkbox" | "radio" | "date" | "email" | "phone" | "file" | "multiselect" | "section" | "signature" | "firstname" | "lastname" | "address";
  label: string;
  required: boolean;
  placeholder?: string;
  showIcon?: boolean;
  optionLayout?: "vertical" | "grid";
  options?: string[];
  helpText?: string;
  defaultValue?: string;
  conditionalLogic?: ConditionalLogic;
  // File upload specific
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in MB
  // Validation
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

// Form theme configuration
export interface FormTheme {
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImage?: string;
  layout?: "card" | "fullwidth";
  fontFamily?: string;
  primaryColor?: string;
  buttonColor?: string;
  buttonText?: string;
  buttonTextColor?: string;
  borderRadius?: string;
  cardShadow?: string;
}

// Template categories
export const TEMPLATE_CATEGORIES = [
  "Job Application",
  "Lead Capture",
  "Intake Form",
  "Survey",
  "Registration",
  "Feedback",
  "Other",
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];

export interface ApplicationFormTemplate {
  id: string;
  name: string;
  description: string | null;
  fields: FormField[];
  layout?: FormRow[]; // Row-based layout structure
  is_active: boolean;
  created_at: string;
  updated_at: string;
  theme?: FormTheme;
  category?: TemplateCategory | null;
  success_message?: string;
  version?: number;
}

export const useApplicationFormTemplates = () => {
  return useQuery({
    queryKey: ["application-form-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_form_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data.map(t => ({
        ...t,
        fields: (t.fields || []) as unknown as FormField[],
        theme: (t.theme || {}) as FormTheme,
      })) as ApplicationFormTemplate[];
    },
  });
};

export const useApplicationFormTemplate = (id: string) => {
  return useQuery({
    queryKey: ["application-form-template", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_form_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return {
        ...data,
        fields: (data.fields || []) as unknown as FormField[],
        theme: (data.theme || {}) as FormTheme,
      } as ApplicationFormTemplate;
    },
    enabled: !!id,
  });
};

export const useCreateApplicationFormTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: {
      name: string;
      description?: string;
      fields: FormField[];
      theme?: FormTheme;
      category?: TemplateCategory | null;
      success_message?: string;
    }) => {
      const { data, error } = await supabase
        .from("application_form_templates")
        .insert({
          name: template.name,
          description: template.description || null,
          fields: template.fields as any,
          theme: (template.theme || {}) as any,
          category: template.category || null,
          success_message: template.success_message || "Thank you for your submission!",
          is_active: true,
          version: 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-form-templates"] });
    },
  });
};

export const useUpdateApplicationFormTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      description?: string;
      fields?: FormField[];
      is_active?: boolean;
      theme?: FormTheme;
      category?: TemplateCategory | null;
      success_message?: string;
    }) => {
      // First get current version
      const { data: current } = await supabase
        .from("application_form_templates")
        .select("version")
        .eq("id", id)
        .single();

      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.fields !== undefined) updateData.fields = updates.fields;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.theme !== undefined) updateData.theme = updates.theme;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.success_message !== undefined) updateData.success_message = updates.success_message;
      
      // Increment version if fields are being updated
      if (updates.fields !== undefined) {
        updateData.version = (current?.version || 1) + 1;
      }

      const { data, error } = await supabase
        .from("application_form_templates")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-form-templates"] });
    },
  });
};

export const useCloneApplicationFormTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch the template to clone
      const { data: original, error: fetchError } = await supabase
        .from("application_form_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Create a copy with a new name
      const { data, error } = await supabase
        .from("application_form_templates")
        .insert({
          name: `${original.name} (Copy)`,
          description: original.description,
          fields: original.fields,
          theme: original.theme,
          category: original.category,
          success_message: original.success_message,
          is_active: false, // Start as inactive
          version: 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-form-templates"] });
    },
  });
};

export const useDeleteApplicationFormTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("application_form_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-form-templates"] });
    },
  });
};
