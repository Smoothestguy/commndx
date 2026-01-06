import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";
import { useAuditLog, computeChanges } from "@/hooks/useAuditLog";
import type { Json } from "@/integrations/supabase/types";

export interface POLineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  total: number;
  billed_quantity?: number;
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
  status: "draft" | "sent" | "acknowledged" | "in-progress" | "completed" | "cancelled" | "pending_approval" | "partially_billed" | "fully_billed" | "closed";
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  billed_amount: number;
  total_addendum_amount: number;
  is_closed: boolean;
  closed_at?: string;
  closed_by?: string;
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

// Helper to check if QuickBooks is connected
async function isQuickBooksConnected(): Promise<boolean> {
  const { data } = await supabase
    .from("quickbooks_config")
    .select("is_connected")
    .single();
  return data?.is_connected === true;
}

export const usePurchaseOrders = () => {
  return useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*")
        .is("deleted_at", null)
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

export const usePurchaseOrdersByVendor = (vendorId: string | undefined) => {
  return useQuery({
    queryKey: ["purchase_orders", "vendor", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PurchaseOrder[];
    },
    enabled: !!vendorId,
  });
};

export const useAddPurchaseOrder = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (data: {
      purchaseOrder: Omit<PurchaseOrder, "id" | "created_at" | "updated_at" | "billed_amount" | "is_closed" | "total_addendum_amount">;
      lineItems: Omit<POLineItem, "id" | "created_at" | "billed_quantity">[];
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

      // Auto-sync to QuickBooks if connected
      try {
        const qbConnected = await isQuickBooksConnected();
        if (qbConnected) {
          console.log("QuickBooks connected - syncing purchase order:", poData.id);
          await supabase.functions.invoke("quickbooks-create-purchase-order", {
            body: { purchaseOrderId: poData.id },
          });
        }
      } catch (qbError) {
        console.error("QuickBooks sync error (non-blocking):", qbError);
        // Don't throw - QB sync failure shouldn't prevent PO creation
      }

      // Log audit action
      await logAction({
        actionType: "create",
        resourceType: "purchase_order",
        resourceId: poData.id,
        resourceNumber: poData.number,
        changesAfter: poData as unknown as Json,
        metadata: { 
          vendor_name: data.purchaseOrder.vendor_name,
          vendor_id: data.purchaseOrder.vendor_id,
          total: data.purchaseOrder.total,
          line_items_count: data.lineItems.length 
        } as Json,
      });

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
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      purchaseOrder: Partial<PurchaseOrder>;
      lineItems?: Omit<POLineItem, "created_at">[];
    }) => {
      // Fetch original for audit
      const { data: originalData } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("id", data.id)
        .single();

      // Update purchase order
      const { data: poData, error: poError } = await supabase
        .from("purchase_orders")
        .update(data.purchaseOrder)
        .eq("id", data.id)
        .select()
        .single();

      if (poError) throw poError;

      // Only update line items if explicitly provided AND has items
      if (data.lineItems !== undefined) {
        if (data.lineItems.length === 0) {
          throw new Error("Cannot update with empty line items. Use restore function to add items or keep existing ones.");
        }

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

      // Log audit action
      const { changesBefore, changesAfter } = computeChanges(
        originalData as Record<string, unknown>,
        poData as Record<string, unknown>
      );
      await logAction({
        actionType: "update",
        resourceType: "purchase_order",
        resourceId: data.id,
        resourceNumber: poData.number,
        changesBefore,
        changesAfter,
      });

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

// Hook to restore/add line items to a PO without replacing existing ones
export const useRestorePOLineItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      purchaseOrderId: string;
      lineItems: Omit<POLineItem, "id" | "billed_quantity">[];
    }) => {
      const lineItemsWithPOId = data.lineItems.map(item => ({
        ...item,
        purchase_order_id: data.purchaseOrderId,
      }));

      const { error } = await supabase
        .from("po_line_items")
        .insert(lineItemsWithPOId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Line items restored successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to restore line items: ${error.message}`);
    },
  });
};

export const useClosePurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .update({
          is_closed: true,
          status: "closed",
          closed_at: new Date().toISOString(),
          closed_by: user?.id,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Purchase order closed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to close purchase order: ${error.message}`);
    },
  });
};

export const useReopenPurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .update({
          is_closed: false,
          status: "in-progress",
          reopened_at: new Date().toISOString(),
          reopened_by: user?.id,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Purchase order reopened successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reopen purchase order: ${error.message}`);
    },
  });
};

export const useDeletePurchaseOrder = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch original for audit
      const { data: originalData } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("id", id)
        .single();

      const { data: { user } } = await supabase.auth.getUser();
      
      // Soft delete instead of hard delete
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .eq("id", id);

      if (error) throw error;

      // Log audit action
      await logAction({
        actionType: "delete",
        resourceType: "purchase_order",
        resourceId: id,
        resourceNumber: originalData?.number,
        changesBefore: originalData as unknown as Json,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["deleted_items"] });
      toast.success("Purchase order moved to trash");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete purchase order: ${error.message}`);
    },
  });
};
