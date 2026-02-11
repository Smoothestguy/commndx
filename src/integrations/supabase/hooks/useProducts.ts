import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export type ItemType = 'product' | 'service' | 'labor';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  markup: number;
  price: number;
  unit: string;
  category: string;
  is_taxable: boolean;
  item_type: ItemType;
  sku: string | null;
  created_at: string;
  updated_at: string;
}

export const useProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
  });
};

export const useAddProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Omit<Product, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("products")
        .insert([product])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Item added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add item: ${error.message}`);
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Item updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Soft delete instead of hard delete
      const { error } = await supabase
        .from("products")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["deleted_items"] });
      toast.success("Item moved to trash");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete item: ${error.message}`);
    },
  });
};

export const useDeleteProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Soft delete instead of hard delete to preserve historical references
      const { error } = await supabase
        .from("products")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["deleted_items"] });
      toast.success(`${ids.length} item(s) moved to trash`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete items: ${error.message}`);
    },
  });
};

export interface BulkUpdateData {
  category?: string;
  markup?: number;
  unit?: string;
  is_taxable?: boolean;
}

export const useBulkUpdateProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      ids, 
      updates, 
      products 
    }: { 
      ids: string[]; 
      updates: BulkUpdateData;
      products: Product[];
    }) => {
      // If updating margin, we need to recalculate prices for each product
      if (updates.markup !== undefined) {
        const selectedProducts = products.filter(p => ids.includes(p.id));
        
        for (const product of selectedProducts) {
          const newMargin = updates.markup;
          const newPrice = newMargin > 0 && newMargin < 100
            ? product.cost / (1 - newMargin / 100) 
            : product.cost;
          
          const { error } = await supabase
            .from("products")
            .update({
              ...updates,
              price: newPrice,
            })
            .eq("id", product.id);

          if (error) throw error;
        }
      } else {
        // No margin update, can do a bulk update
        const { error } = await supabase
          .from("products")
          .update(updates)
          .in("id", ids);

        if (error) throw error;
      }
    },
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`${ids.length} item(s) updated successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update items: ${error.message}`);
    },
  });
};

export const useAddProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (products: Omit<Product, "id" | "created_at" | "updated_at">[]) => {
      const { data, error } = await supabase
        .from("products")
        .insert(products)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`${data.length} item(s) added successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to add items: ${error.message}`);
    },
  });
};
