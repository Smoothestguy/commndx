import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface POLineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  job_order_id: string;
  job_order_number: string;
  vendor_id: string;
  vendor_name: string;
  project_id: string;
  project_name: string;
  customer_id: string;
  customer_name: string;
  status: "draft" | "sent" | "acknowledged" | "in-progress" | "completed" | "cancelled" | "pending_approval";
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes?: string;
  due_date: string;
  approved_by?: string;
  approved_at?: string;
  submitted_for_approval_at?: string;
  submitted_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderWithLineItems extends PurchaseOrder {
  line_items: POLineItem[];
}

export const usePurchaseOrders = () => {
  return useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PurchaseOrder[];
    },
  });
};

export const usePurchaseOrder = (id: string) => {
  return useQuery({
    queryKey: ["purchase_orders", id],
    queryFn: async () => {
      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("id", id)
        .single();

      if (poError) throw poError;

      const { data: lineItems, error: lineItemsError } = await supabase
        .from("po_line_items")
        .select("*")
        .eq("purchase_order_id", id);

      if (lineItemsError) throw lineItemsError;

      return {
        ...po,
        line_items: lineItems,
      } as PurchaseOrderWithLineItems;
    },
  });
};

export const useAddPurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      purchaseOrder: Omit<PurchaseOrder, "id" | "created_at" | "updated_at">;
      lineItems: Omit<POLineItem, "id" | "created_at">[];
    }) => {
      // Insert purchase order
      const { data: poData, error: poError } = await supabase
        .from("purchase_orders")
        .insert([data.purchaseOrder])
        .select()
        .single();

      if (poError) throw poError;

      // Insert line items
      const lineItemsWithPOId = data.lineItems.map(item => ({
        ...item,
        purchase_order_id: poData.id,
      }));

      const { error: lineItemsError } = await supabase
        .from("po_line_items")
        .insert(lineItemsWithPOId);

      if (lineItemsError) throw lineItemsError;

      return poData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Purchase order created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create purchase order: ${error.message}`);
    },
  });
};

export const useUpdatePurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      purchaseOrder: Partial<PurchaseOrder>;
      lineItems?: Omit<POLineItem, "created_at">[];
    }) => {
      // Update purchase order
      const { data: poData, error: poError } = await supabase
        .from("purchase_orders")
        .update(data.purchaseOrder)
        .eq("id", data.id)
        .select()
        .single();

      if (poError) throw poError;

      // If line items are provided, delete old ones and insert new ones
      if (data.lineItems) {
        const { error: deleteError } = await supabase
          .from("po_line_items")
          .delete()
          .eq("purchase_order_id", data.id);

        if (deleteError) throw deleteError;

        const lineItemsWithPOId = data.lineItems.map(item => ({
          ...item,
          purchase_order_id: data.id,
        }));

        const { error: lineItemsError } = await supabase
          .from("po_line_items")
          .insert(lineItemsWithPOId);

        if (lineItemsError) throw lineItemsError;
      }

      return poData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Purchase order updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update purchase order: ${error.message}`);
    },
  });
};

export const useDeletePurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Purchase order deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete purchase order: ${error.message}`);
    },
  });
};
