import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface QBProductMapping {
  id: string;
  name: string;
  quickbooks_item_id: string | null;
  quickbooks_item_type: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useQBProductMappings = () => {
  return useQuery({
    queryKey: ["qb_product_service_mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qb_product_service_mappings")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as QBProductMapping[];
    },
  });
};

export const useCreateQBProductMapping = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      quickbooks_item_type,
    }: {
      name: string;
      quickbooks_item_type: string;
    }) => {
      const { data, error } = await supabase
        .from("qb_product_service_mappings")
        .insert([{ name, quickbooks_item_type, is_active: true }])
        .select()
        .single();

      if (error) throw error;
      return data as QBProductMapping;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qb_product_service_mappings"] });
      toast.success("QB umbrella category created");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create umbrella category: ${error.message}`);
    },
  });
};

export const useDeleteQBProductMapping = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("qb_product_service_mappings")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qb_product_service_mappings"] });
      toast.success("QB umbrella category deactivated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to deactivate: ${error.message}`);
    },
  });
};
