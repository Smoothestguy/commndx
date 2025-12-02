import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface EstimateLineItem {
  id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  pricing_type?: 'markup' | 'margin';
  is_taxable?: boolean;
  total: number;
}

export interface Estimate {
  id: string;
  number: string;
  customer_id: string;
  customer_name: string;
  project_id?: string;
  project_name?: string;
  status: "draft" | "pending" | "approved" | "sent";
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes?: string;
  valid_until: string;
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
  approval_token?: string;
  sent_at?: string;
  customer_approved?: boolean;
  default_pricing_type?: 'markup' | 'margin';
}

export interface EstimateWithLineItems extends Estimate {
  line_items: EstimateLineItem[];
}

export const useEstimates = () => {
  return useQuery({
    queryKey: ["estimates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Estimate[];
    },
  });
};

export const useEstimate = (id: string) => {
  return useQuery({
    queryKey: ["estimates", id],
    queryFn: async () => {
      const { data: estimate, error: estimateError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", id)
        .single();

      if (estimateError) throw estimateError;

      const { data: lineItems, error: lineItemsError } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", id);

      if (lineItemsError) throw lineItemsError;

      return {
        ...estimate,
        line_items: lineItems,
      } as EstimateWithLineItems;
    },
  });
};

export const useAddEstimate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      estimate: Omit<Estimate, "id" | "created_at" | "updated_at">;
      lineItems: Omit<EstimateLineItem, "id" | "created_at">[];
    }) => {
      // Insert estimate
      const { data: estimateData, error: estimateError } = await supabase
        .from("estimates")
        .insert([data.estimate])
        .select()
        .single();

      if (estimateError) throw estimateError;

      // Insert line items
      const lineItemsWithEstimateId = data.lineItems.map(item => ({
        ...item,
        estimate_id: estimateData.id,
      }));

      const { error: lineItemsError } = await supabase
        .from("estimate_line_items")
        .insert(lineItemsWithEstimateId);

      if (lineItemsError) throw lineItemsError;

      return estimateData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Estimate created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create estimate: ${error.message}`);
    },
  });
};

export const useUpdateEstimate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      estimate: Partial<Estimate>;
      lineItems?: Omit<EstimateLineItem, "created_at">[];
    }) => {
      // Update estimate
      const { data: estimateData, error: estimateError } = await supabase
        .from("estimates")
        .update(data.estimate)
        .eq("id", data.id)
        .select()
        .single();

      if (estimateError) throw estimateError;

      // If line items are provided, delete old ones and insert new ones
      if (data.lineItems) {
        const { error: deleteError } = await supabase
          .from("estimate_line_items")
          .delete()
          .eq("estimate_id", data.id);

        if (deleteError) throw deleteError;

        const lineItemsWithEstimateId = data.lineItems.map(item => ({
          ...item,
          estimate_id: data.id,
        }));

        const { error: lineItemsError } = await supabase
          .from("estimate_line_items")
          .insert(lineItemsWithEstimateId);

        if (lineItemsError) throw lineItemsError;
      }

      return estimateData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Estimate updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update estimate: ${error.message}`);
    },
  });
};

export const useDeleteEstimate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First, unlink any job orders that reference this estimate
      await supabase
        .from("job_orders")
        .update({ estimate_id: null })
        .eq("estimate_id", id);
      
      // Then delete estimate line items
      await supabase
        .from("estimate_line_items")
        .delete()
        .eq("estimate_id", id);
      
      // Finally delete the estimate
      const { error } = await supabase.from("estimates").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["job_orders"] });
      toast.success("Estimate deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete estimate: ${error.message}`);
    },
  });
};

export const useConvertEstimateToJobOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (estimateId: string) => {
      // Fetch estimate with line items
      const { data: estimate, error: estimateError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", estimateId)
        .single();

      if (estimateError) throw estimateError;

      const { data: lineItems, error: lineItemsError } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimateId);

      if (lineItemsError) throw lineItemsError;

      // Validate estimate
      if (estimate.status !== "approved") {
        throw new Error("Only approved estimates can be converted to job orders");
      }

      if (!estimate.project_id) {
        throw new Error("Estimate must have a project to convert to job order");
      }

      // Check if already converted
      const { data: existingJobOrder } = await supabase
        .from("job_orders")
        .select("id")
        .eq("estimate_id", estimateId)
        .maybeSingle();

      if (existingJobOrder) {
        throw new Error("This estimate has already been converted to a job order");
      }

      // Generate job order number
      const { data: latestJobOrder } = await supabase
        .from("job_orders")
        .select("number")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNumber = 1;
      if (latestJobOrder?.number) {
        const match = latestJobOrder.number.match(/JO-\d{4}-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const year = new Date().getFullYear();
      const jobOrderNumber = `JO-${year}-${String(nextNumber).padStart(3, "0")}`;

      // Create job order
      const { data: jobOrder, error: jobOrderError } = await supabase
        .from("job_orders")
        .insert([
          {
            number: jobOrderNumber,
            estimate_id: estimateId,
            customer_id: estimate.customer_id,
            customer_name: estimate.customer_name,
            project_id: estimate.project_id,
            project_name: estimate.project_name,
            status: "active",
            subtotal: estimate.subtotal,
            tax_rate: estimate.tax_rate,
            tax_amount: estimate.tax_amount,
            total: estimate.total,
            invoiced_amount: 0,
            remaining_amount: estimate.total,
            start_date: new Date().toISOString().split("T")[0],
          },
        ])
        .select()
        .single();

      if (jobOrderError) throw jobOrderError;

      // Create job order line items
      const jobOrderLineItems = lineItems.map((item) => ({
        job_order_id: jobOrder.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        markup: item.markup,
        total: item.total,
      }));

      const { error: lineItemsInsertError } = await supabase
        .from("job_order_line_items")
        .insert(jobOrderLineItems);

      if (lineItemsInsertError) throw lineItemsInsertError;

      return jobOrder;
    },
    onSuccess: (jobOrder) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["job_orders"] });
      toast.success(`Job order ${jobOrder.number} created successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to convert estimate: ${error.message}`);
    },
  });
};
