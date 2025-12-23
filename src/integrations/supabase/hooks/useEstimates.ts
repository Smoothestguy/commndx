import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";
import { getNextInvoiceNumber } from "@/utils/invoiceNumberGenerator";

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
  created_by?: string;
  jobsite_address?: string | null;
}

export interface CustomerContactInfo {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  jobsite_address?: string | null;
}

export interface EstimateCreatorProfile {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface EstimateWithLineItems extends Estimate {
  line_items: EstimateLineItem[];
  created_by_profile?: EstimateCreatorProfile | null;
  customer_contact?: CustomerContactInfo | null;
}

// Helper to check if QuickBooks is connected
async function isQuickBooksConnected(): Promise<boolean> {
  const { data } = await supabase
    .from("quickbooks_config")
    .select("is_connected")
    .single();
  return data?.is_connected === true;
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
        .eq("estimate_id", id)
        .order("sort_order", { ascending: true });

      if (lineItemsError) throw lineItemsError;

      // Fetch creator profile if created_by exists
      let createdByProfile: EstimateCreatorProfile | null = null;
      if (estimate.created_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("id", estimate.created_by)
          .single();
        createdByProfile = profile;
      }

      // Fetch customer contact info
      let customerContact: CustomerContactInfo | null = null;
      if (estimate.customer_id) {
        const { data: customer } = await supabase
          .from("customers")
          .select("phone, email, address, jobsite_address")
          .eq("id", estimate.customer_id)
          .single();
        customerContact = customer;
      }

      return {
        ...estimate,
        line_items: lineItems,
        created_by_profile: createdByProfile,
        customer_contact: customerContact,
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
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      
      // Insert estimate with created_by
      const { data: estimateData, error: estimateError } = await supabase
        .from("estimates")
        .insert([{ ...data.estimate, created_by: user?.id }])
        .select()
        .single();

      if (estimateError) throw estimateError;

      // Insert line items with sort_order
      const lineItemsWithEstimateId = data.lineItems.map((item, index) => ({
        ...item,
        estimate_id: estimateData.id,
        sort_order: index,
      }));

      const { error: lineItemsError } = await supabase
        .from("estimate_line_items")
        .insert(lineItemsWithEstimateId);

      if (lineItemsError) throw lineItemsError;

      // Auto-sync to QuickBooks if connected
      try {
        const qbConnected = await isQuickBooksConnected();
        if (qbConnected) {
          console.log("QuickBooks connected - syncing estimate:", estimateData.id);
          await supabase.functions.invoke("quickbooks-create-estimate", {
            body: { estimateId: estimateData.id },
          });
        }
      } catch (qbError) {
        console.error("QuickBooks sync error (non-blocking):", qbError);
        // Don't throw - QB sync failure shouldn't prevent estimate creation
      }

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

        const lineItemsWithEstimateId = data.lineItems.map((item, index) => ({
          ...item,
          estimate_id: data.id,
          sort_order: index,
        }));

        const { error: lineItemsError } = await supabase
          .from("estimate_line_items")
          .insert(lineItemsWithEstimateId);

        if (lineItemsError) throw lineItemsError;
      }

      return estimateData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["estimates", data.id] });
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
    mutationFn: async (params: { 
      estimateId: string; 
      projectId?: string; 
      projectName?: string;
    }) => {
      const { estimateId, projectId: overrideProjectId, projectName: overrideProjectName } = params;
      
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

      // Use override project or estimate's project
      const projectId = overrideProjectId || estimate.project_id;
      const projectName = overrideProjectName || estimate.project_name;

      if (!projectId) {
        throw new Error("A project must be selected to convert to job order");
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
            project_id: projectId,
            project_name: projectName,
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

      // Create job order line items (preserve is_taxable from estimate)
      const jobOrderLineItems = lineItems.map((item) => ({
        job_order_id: jobOrder.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        markup: item.markup,
        total: item.total,
        is_taxable: item.is_taxable ?? true,
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

export const useConvertEstimateToInvoice = () => {
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
        throw new Error("Only approved estimates can be converted to invoices");
      }

      // Check if already converted to invoice
      const { data: existingInvoice } = await supabase
        .from("invoices")
        .select("id")
        .eq("estimate_id", estimateId)
        .maybeSingle();

      if (existingInvoice) {
        throw new Error("This estimate has already been converted to an invoice");
      }

      // Use the shared invoice number generator
      const { number: invoiceNumber } = await getNextInvoiceNumber();

      // Calculate due date (30 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert([
          {
            number: invoiceNumber,
            estimate_id: estimateId,
            customer_id: estimate.customer_id,
            customer_name: estimate.customer_name,
            project_name: estimate.project_name,
            status: "draft",
            subtotal: estimate.subtotal,
            tax_rate: estimate.tax_rate,
            tax_amount: estimate.tax_amount,
            total: estimate.total,
            due_date: dueDate.toISOString().split("T")[0],
          },
        ])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice line items
      const invoiceLineItems = lineItems.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        markup: item.markup,
        total: item.total,
      }));

      const { error: lineItemsInsertError } = await supabase
        .from("invoice_line_items")
        .insert(invoiceLineItems);

      if (lineItemsInsertError) throw lineItemsInsertError;

      return invoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`Invoice ${invoice.number} created successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to convert estimate to invoice: ${error.message}`);
    },
  });
};
