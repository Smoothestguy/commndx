import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

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

export interface JobOrderWithLineItems extends JobOrder {
  line_items: JobOrderLineItem[];
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
      const { data: jobOrder, error: jobOrderError } = await supabase
        .from("job_orders")
        .select("*")
        .eq("id", id)
        .single();

      if (jobOrderError) throw jobOrderError;

      const { data: lineItems, error: lineItemsError } = await supabase
        .from("job_order_line_items")
        .select("*")
        .eq("job_order_id", id);

      if (lineItemsError) throw lineItemsError;

      return {
        ...jobOrder,
        line_items: lineItems,
      } as JobOrderWithLineItems;
    },
  });
};

export const useAddJobOrder = () => {
  const queryClient = useQueryClient();

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

  return useMutation({
    mutationFn: async (data: {
      id: string;
      jobOrder: Partial<JobOrder>;
      lineItems?: Omit<JobOrderLineItem, "created_at">[];
    }) => {
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

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("job_orders").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job_orders"] });
      toast.success("Job order deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete job order: ${error.message}`);
    },
  });
};
