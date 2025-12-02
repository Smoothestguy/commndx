import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface ProductUnit {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export const useProductUnits = () => {
  return useQuery({
    queryKey: ["product_units"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_units")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as ProductUnit[];
    },
  });
};

export const useAddProductUnit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (unit: { name: string }) => {
      const { data, error } = await supabase
        .from("product_units")
        .insert([unit])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_units"] });
      toast.success("Unit added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add unit: ${error.message}`);
    },
  });
};
