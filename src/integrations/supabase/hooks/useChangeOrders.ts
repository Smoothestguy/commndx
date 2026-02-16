import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuditLog, computeChanges } from "@/hooks/useAuditLog";
import type { Json } from "../types";

export type ChangeOrderStatus = 'draft' | 'pending_approval' | 'pending_field_supervisor' | 'pending_customer_pm' | 'approved_pending_wo' | 'approved' | 'rejected' | 'invoiced';
export type ChangeType = 'additive' | 'deductive';

export interface ChangeOrderLineItem {
  id: string;
  change_order_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  vendor_cost: number;
  markup: number;
  total: number;
  is_taxable: boolean;
  sort_order: number;
  created_at: string;
  original_scope_description: string | null;
}

export interface ChangeOrder {
  id: string;
  number: string;
  project_id: string;
  purchase_order_id: string | null;
  job_order_id: string | null;
  customer_id: string;
  customer_name: string;
  vendor_id: string | null;
  vendor_name: string | null;
  status: ChangeOrderStatus;
  reason: string;
  description: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  change_type: ChangeType;
  file_name: string | null;
  file_path: string | null;
  file_type: string | null;
  file_size: number | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  scope_reference: string | null;
  source_estimate_id: string | null;
  source_job_order_id: string | null;
  invoiced_amount: number;
  remaining_amount: number;
  // Workflow fields
  work_authorized: boolean;
  customer_wo_number: string | null;
  customer_wo_file_path: string | null;
  customer_wo_uploaded_at: string | null;
  field_supervisor_approval_token: string | null;
  field_supervisor_signed_at: string | null;
  field_supervisor_signature: string | null;
  customer_pm_approval_token: string | null;
  customer_pm_signed_at: string | null;
  customer_pm_signature: string | null;
  sent_for_approval_at: string | null;
  photos: string[] | null;
}

export interface ChangeOrderWithLineItems extends ChangeOrder {
  line_items: ChangeOrderLineItem[];
  project?: { id: string; name: string };
  purchase_order?: { id: string; number: string } | null;
  job_order?: { id: string; number: string } | null;
}

export interface ChangeOrderVendorBill {
  id: string;
  change_order_id: string;
  vendor_bill_id: string;
  created_at: string;
}

// Fetch all change orders
export function useChangeOrders(filters?: { projectId?: string; status?: ChangeOrderStatus }) {
  return useQuery({
    queryKey: ["change_orders", filters],
    queryFn: async () => {
      let query = supabase
        .from("change_orders")
        .select("*, project:projects(id, name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (filters?.projectId) {
        query = query.eq("project_id", filters.projectId);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as (ChangeOrder & { project: { id: string; name: string } })[];
    },
  });
}

// Fetch single change order with line items
export function useChangeOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["change_orders", id],
    queryFn: async () => {
      if (!id) return null;

      const { data: changeOrder, error } = await supabase
        .from("change_orders")
        .select(`
          *,
          project:projects(id, name),
          purchase_order:purchase_orders(id, number),
          job_order:job_orders!change_orders_job_order_id_fkey(id, number),
          source_job_order:job_orders!change_orders_source_job_order_id_fkey(id, number)
        `)
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        console.error('Error fetching change order:', error);
        throw error;
      }

      if (!changeOrder) return null;

      const { data: lineItems, error: lineItemsError } = await supabase
        .from("change_order_line_items")
        .select("*")
        .eq("change_order_id", id)
        .order("sort_order", { ascending: true });

      if (lineItemsError) throw lineItemsError;

      return {
        ...changeOrder,
        line_items: lineItems || [],
      } as unknown as ChangeOrderWithLineItems;
    },
    enabled: !!id,
  });
}

// Fetch change orders by project
export function useChangeOrdersByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["change_orders", "project", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("change_orders")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("number", { ascending: true });

      if (error) throw error;
      return data as unknown as ChangeOrder[];
    },
    enabled: !!projectId,
  });
}

// Fetch change orders by purchase order
export function useChangeOrdersByPurchaseOrder(purchaseOrderId: string | undefined) {
  return useQuery({
    queryKey: ["change_orders", "purchase_order", purchaseOrderId],
    queryFn: async () => {
      if (!purchaseOrderId) return [];

      const { data, error } = await supabase
        .from("change_orders")
        .select("*")
        .eq("purchase_order_id", purchaseOrderId)
        .is("deleted_at", null)
        .order("number", { ascending: true });

      if (error) throw error;
      return data as unknown as ChangeOrder[];
    },
    enabled: !!purchaseOrderId,
  });
}

// Add change order
export function useAddChangeOrder() {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (data: {
      project_id: string;
      customer_id: string;
      customer_name: string;
      reason: string;
      description?: string;
      purchase_order_id?: string;
      job_order_id?: string;
      vendor_id?: string;
      vendor_name?: string;
      tax_rate: number;
      change_type?: ChangeType;
      scope_reference?: string | null;
      source_estimate_id?: string;
      source_job_order_id?: string;
      line_items: Omit<ChangeOrderLineItem, "id" | "change_order_id" | "created_at">[];
    }) => {
      const { line_items, ...changeOrderData } = data;

      // Calculate totals - allow negative values for deductive COs
      const subtotal = line_items.reduce((sum, item) => sum + (item.total || 0), 0);
      const taxableAmount = line_items
        .filter((item) => item.is_taxable)
        .reduce((sum, item) => sum + (item.total || 0), 0);
      const taxAmount = taxableAmount * ((changeOrderData.tax_rate || 0) / 100);
      const total = subtotal + taxAmount;

      const calculatedRemaining = total || 0;
      
      const insertData = {
        ...changeOrderData,
        subtotal: subtotal || 0,
        tax_amount: taxAmount || 0,
        total: total || 0,
        remaining_amount: calculatedRemaining,
        change_type: changeOrderData.change_type || 'additive',
        scope_reference: changeOrderData.scope_reference || null,
        source_estimate_id: changeOrderData.source_estimate_id || null,
        source_job_order_id: changeOrderData.source_job_order_id || null,
      };

      const { data: changeOrder, error } = await supabase
        .from("change_orders")
        .insert(insertData as never)
        .select()
        .single();

      if (error) throw error;

      // Insert line items
      if (line_items.length > 0) {
        const { error: lineItemsError } = await supabase
          .from("change_order_line_items")
          .insert(
          line_items.map((item, index) => ({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              vendor_cost: item.vendor_cost || 0,
              markup: item.markup,
              total: item.total,
              is_taxable: item.is_taxable,
              product_id: item.product_id,
              change_order_id: (changeOrder as { id: string }).id,
              sort_order: index,
              original_scope_description: item.original_scope_description || null,
            })) as never
          );

        if (lineItemsError) throw lineItemsError;
      }

      // Log the action
      await logAction({
        actionType: "create",
        resourceType: "change_order",
        resourceId: (changeOrder as { id: string; number: string }).id,
        resourceNumber: (changeOrder as { number: string }).number,
        changesAfter: { number: (changeOrder as { number: string }).number, total, customer_name: data.customer_name } as unknown as Json,
      });

      return changeOrder as unknown as ChangeOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change_orders"] });
      toast.success("Change order created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create change order: " + error.message);
    },
  });
}

// Update change order
export function useUpdateChangeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      project_id?: string;
      customer_id?: string;
      customer_name?: string;
      reason?: string;
      description?: string;
      purchase_order_id?: string | null;
      job_order_id?: string | null;
      vendor_id?: string | null;
      vendor_name?: string | null;
      status?: ChangeOrderStatus;
      tax_rate?: number;
      change_type?: ChangeType;
      scope_reference?: string | null;
      source_estimate_id?: string | null;
      source_job_order_id?: string | null;
      line_items?: Omit<ChangeOrderLineItem, "id" | "change_order_id" | "created_at">[];
    }) => {
      const { id, line_items, ...updateData } = data;

      let finalUpdateData: Record<string, unknown> = { ...updateData };

      // If line items provided, recalculate totals
      if (line_items) {
        const subtotal = line_items.reduce((sum, item) => sum + item.total, 0);
        const taxableAmount = line_items
          .filter((item) => item.is_taxable)
          .reduce((sum, item) => sum + item.total, 0);
        const taxAmount = taxableAmount * ((updateData.tax_rate || 0) / 100);
        const total = subtotal + taxAmount;

        finalUpdateData = {
          ...finalUpdateData,
          subtotal,
          tax_amount: taxAmount,
          total,
        };

        // Delete existing line items and insert new ones
        const { error: deleteError } = await supabase
          .from("change_order_line_items")
          .delete()
          .eq("change_order_id", id);

        if (deleteError) throw deleteError;

        if (line_items.length > 0) {
          const { error: insertError } = await supabase
            .from("change_order_line_items")
            .insert(
            line_items.map((item, index) => ({
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                vendor_cost: item.vendor_cost || 0,
                markup: item.markup,
                total: item.total,
                is_taxable: item.is_taxable,
                product_id: item.product_id,
                change_order_id: id,
                sort_order: index,
                original_scope_description: item.original_scope_description || null,
              })) as never
            );

          if (insertError) throw insertError;
        }
      }

      // Update change order
      const { data: changeOrder, error } = await supabase
        .from("change_orders")
        .update(finalUpdateData as never)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return changeOrder as unknown as ChangeOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change_orders"] });
      toast.success("Change order updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update change order: " + error.message);
    },
  });
}

// Delete change order (soft delete)
export function useDeleteChangeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("change_orders")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .eq("id", id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change_orders"] });
      queryClient.invalidateQueries({ queryKey: ["deleted_items"] });
      toast.success("Change order moved to trash");
    },
    onError: (error) => {
      toast.error("Failed to delete change order: " + error.message);
    },
  });
}

// Hard delete change order (permanent)
export function useHardDeleteChangeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete related line items first
      const { error: lineItemsError } = await supabase
        .from("change_order_line_items")
        .delete()
        .eq("change_order_id", id);
      
      if (lineItemsError) throw lineItemsError;

      // Delete related vendor bill links
      const { error: vendorBillsError } = await supabase
        .from("change_order_vendor_bills")
        .delete()
        .eq("change_order_id", id);
      
      if (vendorBillsError) throw vendorBillsError;

      // Permanently delete change order
      const { error } = await supabase
        .from("change_orders")
        .delete()
        .eq("id", id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change_orders"] });
      toast.success("Change order permanently deleted");
    },
    onError: (error) => {
      toast.error("Failed to permanently delete: " + error.message);
    },
  });
}

// Approve/Reject change order
export function useUpdateChangeOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; status: ChangeOrderStatus; approved_by?: string }) => {
      const updateData: Record<string, unknown> = { status: data.status };

      if (data.status === "approved" && data.approved_by) {
        updateData.approved_by = data.approved_by;
        updateData.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("change_orders")
        .update(updateData as never)
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["change_orders"] });
      const statusMessages: Record<ChangeOrderStatus, string> = {
        draft: "Change order moved to draft",
        pending_approval: "Change order submitted for approval",
        pending_field_supervisor: "Sent to field supervisor for approval",
        pending_customer_pm: "Sent to customer PM for approval",
        approved_pending_wo: "Approved — awaiting work order",
        approved: "Change order approved",
        rejected: "Change order rejected",
        invoiced: "Change order marked as invoiced",
      };
      toast.success(statusMessages[variables.status]);
    },
    onError: (error) => {
      toast.error("Failed to update change order status: " + error.message);
    },
  });
}

// Link vendor bill to change order
export function useLinkVendorBillToChangeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { change_order_id: string; vendor_bill_id: string }) => {
      const { error } = await supabase
        .from("change_order_vendor_bills")
        .insert(data as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change_orders"] });
      queryClient.invalidateQueries({ queryKey: ["change_order_vendor_bills"] });
      toast.success("Vendor bill linked successfully");
    },
    onError: (error) => {
      toast.error("Failed to link vendor bill: " + error.message);
    },
  });
}

// Unlink vendor bill from change order
export function useUnlinkVendorBillFromChangeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { change_order_id: string; vendor_bill_id: string }) => {
      const { error } = await supabase
        .from("change_order_vendor_bills")
        .delete()
        .eq("change_order_id", data.change_order_id)
        .eq("vendor_bill_id", data.vendor_bill_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change_orders"] });
      queryClient.invalidateQueries({ queryKey: ["change_order_vendor_bills"] });
      toast.success("Vendor bill unlinked successfully");
    },
    onError: (error) => {
      toast.error("Failed to unlink vendor bill: " + error.message);
    },
  });
}

// Get linked vendor bills for a change order
export function useChangeOrderVendorBills(changeOrderId: string | undefined) {
  return useQuery({
    queryKey: ["change_order_vendor_bills", changeOrderId],
    queryFn: async () => {
      if (!changeOrderId) return [];

      const { data, error } = await supabase
        .from("change_order_vendor_bills")
        .select(`
          *,
          vendor_bill:vendor_bills(*)
        `)
        .eq("change_order_id", changeOrderId);

      if (error) throw error;
      return data;
    },
    enabled: !!changeOrderId,
  });
}
