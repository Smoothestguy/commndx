import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FormField {
  id: string;
  type: "text" | "textarea" | "number" | "dropdown" | "checkbox" | "radio" | "date";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface ApplicationFormTemplate {
  id: string;
  name: string;
  description: string | null;
  fields: FormField[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
        fields: (t.fields || []) as unknown as FormField[]
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
        fields: (data.fields || []) as unknown as FormField[]
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
    }) => {
      const { data, error } = await supabase
        .from("application_form_templates")
        .insert({
          name: template.name,
          description: template.description || null,
          fields: template.fields as any,
          is_active: true,
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
    }) => {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.fields !== undefined) updateData.fields = updates.fields;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

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
