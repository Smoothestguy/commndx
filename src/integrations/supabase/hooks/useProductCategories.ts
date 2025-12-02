import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export type ItemType = 'product' | 'service' | 'labor';

export interface ProductCategory {
  id: string;
  name: string;
  item_type: ItemType;
  created_at: string;
  updated_at: string;
}

export const useProductCategories = () => {
  return useQuery({
    queryKey: ["product_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as ProductCategory[];
    },
  });
};

export const useAddProductCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: { name: string; item_type: ItemType }) => {
      const { data, error } = await supabase
        .from("product_categories")
        .insert([category])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_categories"] });
    },
    onError: (error: Error) => {
      // Don't show error for duplicates - category already exists
      if (!error.message.includes("duplicate")) {
        toast.error(`Failed to add category: ${error.message}`);
      }
    },
  });
};

export const useDeleteProductCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_categories"] });
      toast.success("Category deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete category: ${error.message}`);
    },
  });
};
