import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";
import { useAuditLog, computeChanges } from "@/hooks/useAuditLog";
import type { Json } from "@/integrations/supabase/types";

export interface JobOrderLineItem {
  id?: string;
  product_id?: string;
  product_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  total: number;
  invoiced_quantity?: number;
  billed_quantity?: number;
  is_taxable?: boolean;
}

export interface JobOrder {
  id: string;
  number: string;
  estimate_id: string | null;
  customer_id: string;
  customer_name: string;
  project_id: string;
  project_name: string;
  status: "active" | "in-progress" | "completed" | "on-hold";
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  invoiced_amount: number;
  remaining_amount: number;
  start_date: string;
  completion_date?: string;
  created_at: string;
  updated_at: string;
}

export interface RelatedPurchaseOrder {
  id: string;
  number: string;
  vendor_name: string;
  total: number;
  status: string;
}

export interface RelatedChangeOrder {
  id: string;
  number: string;
  reason: string;
  total: number;
  status: string;
  change_type: string;
}

export interface JobOrderWithLineItems extends JobOrder {
  line_items: JobOrderLineItem[];
  // Project details
  project_description?: string | null;
  project_address?: string | null;
  project_city?: string | null;
  project_state?: string | null;
  project_zip?: string | null;
  project_poc_name?: string | null;
  project_poc_phone?: string | null;
  project_poc_email?: string | null;
  // Related items
  purchase_orders?: RelatedPurchaseOrder[];
  change_orders?: RelatedChangeOrder[];
}

export const useJobOrders = () => {
  return useQuery({
    queryKey: ["job_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as JobOrder[];
    },
  });
};

export const useJobOrder = (id: string) => {
  return useQuery({
    queryKey: ["job_orders", id],
    queryFn: async () => {
      // Fetch job order with project details
      const { data: jobOrder, error: jobOrderError } = await supabase
        .from("job_orders")
        .select(`
          *,
          projects (
            description,
            address,
            city,
            state,
            zip,
            poc_name,
            poc_phone,
            poc_email
          )
        `)
        .eq("id", id)
        .single();

      if (jobOrderError) throw jobOrderError;

      // Fetch line items
      const { data: lineItems, error: lineItemsError } = await supabase
        .from("job_order_line_items")
        .select("*")
        .eq("job_order_id", id);

      if (lineItemsError) throw lineItemsError;

      // Fetch related purchase orders
      const { data: purchaseOrders, error: poError } = await supabase
        .from("purchase_orders")
        .select("id, number, vendor_name, total, status")
        .eq("job_order_id", id)
        .is("deleted_at", null);

      if (poError) throw poError;

      // Fetch related change orders (by job_order_id or project_id)
      const { data: changeOrders, error: coError } = await supabase
        .from("change_orders")
        .select("id, number, reason, total, status, change_type")
        .or(`job_order_id.eq.${id},project_id.eq.${jobOrder.project_id}`)
        .is("deleted_at", null);

      if (coError) throw coError;

      // Flatten project data into the job order object
      const project = jobOrder.projects as any;
      
      return {
        ...jobOrder,
        line_items: lineItems,
        project_description: project?.description || null,
        project_address: project?.address || null,
        project_city: project?.city || null,
        project_state: project?.state || null,
        project_zip: project?.zip || null,
        project_poc_name: project?.poc_name || null,
        project_poc_phone: project?.poc_phone || null,
        project_poc_email: project?.poc_email || null,
        purchase_orders: purchaseOrders as RelatedPurchaseOrder[],
        change_orders: changeOrders as RelatedChangeOrder[],
      } as JobOrderWithLineItems;
    },
    enabled: !!id,
  });
};

export const useAddJobOrder = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (data: {
      jobOrder: Omit<JobOrder, "id" | "created_at" | "updated_at">;
      lineItems: Omit<JobOrderLineItem, "id" | "created_at">[];
    }) => {
      // Insert job order
      const { data: jobOrderData, error: jobOrderError } = await supabase
        .from("job_orders")
        .insert([data.jobOrder])
        .select()
        .single();

      if (jobOrderError) throw jobOrderError;

      // Insert line items
      const lineItemsWithJobOrderId = data.lineItems.map(item => ({
        ...item,
        job_order_id: jobOrderData.id,
      }));

      const { error: lineItemsError } = await supabase
        .from("job_order_line_items")
        .insert(lineItemsWithJobOrderId);

      if (lineItemsError) throw lineItemsError;

      // Log audit action
      await logAction({
        actionType: "create",
        resourceType: "job_order",
        resourceId: jobOrderData.id,
        resourceNumber: jobOrderData.number,
        changesAfter: jobOrderData as unknown as Json,
        metadata: { 
          customer_name: data.jobOrder.customer_name,
          project_name: data.jobOrder.project_name,
          total: data.jobOrder.total,
          line_items_count: data.lineItems.length 
        } as Json,
      });

      return jobOrderData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job_orders"] });
      toast.success("Job order created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create job order: ${error.message}`);
    },
  });
};

export const useUpdateJobOrder = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      jobOrder: Partial<JobOrder>;
      lineItems?: Omit<JobOrderLineItem, "created_at">[];
    }) => {
      // Fetch original for audit
      const { data: originalData } = await supabase
        .from("job_orders")
        .select("*")
        .eq("id", data.id)
        .single();

      // Update job order
      const { data: jobOrderData, error: jobOrderError } = await supabase
        .from("job_orders")
        .update(data.jobOrder)
        .eq("id", data.id)
        .select()
        .single();

      if (jobOrderError) throw jobOrderError;

      // If line items are provided, delete old ones and insert new ones
      if (data.lineItems) {
        const { error: deleteError } = await supabase
          .from("job_order_line_items")
          .delete()
          .eq("job_order_id", data.id);

        if (deleteError) throw deleteError;

        const lineItemsWithJobOrderId = data.lineItems.map(item => ({
          ...item,
          job_order_id: data.id,
        }));

        const { error: lineItemsError } = await supabase
          .from("job_order_line_items")
          .insert(lineItemsWithJobOrderId);

        if (lineItemsError) throw lineItemsError;
      }

      // Log audit action
      const { changesBefore, changesAfter } = computeChanges(
        originalData as Record<string, unknown>,
        jobOrderData as Record<string, unknown>
      );
      await logAction({
        actionType: "update",
        resourceType: "job_order",
        resourceId: data.id,
        resourceNumber: jobOrderData.number,
        changesBefore,
        changesAfter,
      });

      return jobOrderData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job_orders"] });
      toast.success("Job order updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update job order: ${error.message}`);
    },
  });
};

export const useDeleteJobOrder = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch original for audit
      const { data: originalData } = await supabase
        .from("job_orders")
        .select("*")
        .eq("id", id)
        .single();

      const { data: { user } } = await supabase.auth.getUser();
      
      // Soft delete instead of hard delete
      const { error } = await supabase
        .from("job_orders")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .eq("id", id);

      if (error) throw error;

      // Log audit action
      await logAction({
        actionType: "delete",
        resourceType: "job_order",
        resourceId: id,
        resourceNumber: originalData?.number,
        changesBefore: originalData as unknown as Json,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job_orders"] });
      queryClient.invalidateQueries({ queryKey: ["deleted_items"] });
      toast.success("Job order moved to trash");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete job order: ${error.message}`);
    },
  });
};
