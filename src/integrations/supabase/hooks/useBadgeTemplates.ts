import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type BadgeTemplate = Database["public"]["Tables"]["badge_templates"]["Row"];
type BadgeTemplateInsert = Database["public"]["Tables"]["badge_templates"]["Insert"];
type BadgeTemplateUpdate = Database["public"]["Tables"]["badge_templates"]["Update"];

export const useBadgeTemplates = () => {
  return useQuery({
    queryKey: ["badge-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badge_templates")
        .select(
          `
          *,
          fields:badge_template_fields(*)
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useBadgeTemplateById = (id: string | undefined) => {
  return useQuery({
    queryKey: ["badge-template", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("badge_templates")
        .select(
          `
          *,
          fields:badge_template_fields(*)
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useDefaultBadgeTemplate = () => {
  return useQuery({
    queryKey: ["default-badge-template"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badge_templates")
        .select(
          `
          *,
          fields:badge_template_fields(*)
        `
        )
        .eq("is_default", true)
        .single();

      if (error) throw error;
      return data;
    },
  });
};

export const useAddBadgeTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: BadgeTemplateInsert) => {
      const { data, error } = await supabase
        .from("badge_templates")
        .insert(template)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badge-templates"] });
      toast.success("Badge template created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });
};

export const useUpdateBadgeTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: BadgeTemplateUpdate;
    }) => {
      const { data, error } = await supabase
        .from("badge_templates")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["badge-templates"] });
      queryClient.invalidateQueries({
        queryKey: ["badge-template", variables.id],
      });
      toast.success("Badge template updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });
};

export const useDeleteBadgeTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("badge_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badge-templates"] });
      toast.success("Badge template deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });
};

export const useSetDefaultTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First, unset all defaults
      await supabase
        .from("badge_templates")
        .update({ is_default: false })
        .neq("id", "");

      // Then set the new default
      const { error } = await supabase
        .from("badge_templates")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badge-templates"] });
      queryClient.invalidateQueries({ queryKey: ["default-badge-template"] });
      toast.success("Default template updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to set default: ${error.message}`);
    },
  });
};
