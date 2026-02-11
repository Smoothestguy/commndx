import { useQuery } from "@tanstack/react-query";
import { supabase } from "../client";

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
