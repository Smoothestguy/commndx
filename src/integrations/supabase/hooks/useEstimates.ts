import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";
import { getNextInvoiceNumber } from "@/utils/invoiceNumberGenerator";
import { useAuditLog, computeChanges } from "@/hooks/useAuditLog";
import type { Json } from "../types";

export interface EstimateLineItem {
  id?: string;
  product_id?: string;
  product_name?: string;
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
  status: "draft" | "pending" | "approved" | "sent" | "closed";
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

export const useEstimates = (options?: { includeClosed?: boolean }) => {
  return useQuery({
    queryKey: ["estimates", options?.includeClosed],
    queryFn: async () => {
      let query = supabase
        .from("estimates")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      // Exclude closed estimates by default
      if (!options?.includeClosed) {
        query = query.neq("status", "closed");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Estimate[];
    },
  });
};

export const useBulkUpdateEstimates = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      ids: string[];
      updates: Partial<Pick<Estimate, 'status'>>;
    }) => {
      const { ids, updates } = params;
      
      const { error } = await supabase
        .from("estimates")
        .update(updates)
        .in("id", ids);

      if (error) throw error;
      return { count: ids.length };
    },
    onSuccess: ({ count }) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success(`${count} estimate(s) updated successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update estimates: ${error.message}`);
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
  const { logAction } = useAuditLog();

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

      // Log the action
      await logAction({
        actionType: "create",
        resourceType: "estimate",
        resourceId: estimateData.id,
        resourceNumber: estimateData.number,
        changesAfter: {
          number: estimateData.number,
          customer_name: estimateData.customer_name,
          total: estimateData.total,
          status: estimateData.status,
          line_items_count: data.lineItems.length,
        } as unknown as Json,
      });

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
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      estimate: Partial<Estimate>;
      lineItems?: Omit<EstimateLineItem, "created_at">[];
    }) => {
      // Fetch current data for comparison
      const { data: before } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", data.id)
        .single();

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

      // Log the action with changes
      const { changesBefore, changesAfter } = computeChanges(
        before as Record<string, unknown>,
        estimateData as Record<string, unknown>
      );
      await logAction({
        actionType: "update",
        resourceType: "estimate",
        resourceId: data.id,
        resourceNumber: estimateData.number,
        changesBefore,
        changesAfter,
      });

      // Auto-sync to QuickBooks if connected and estimate is synced
      try {
        console.log("[QB Sync] Checking QuickBooks connection for estimate update:", data.id);
        const qbConnected = await isQuickBooksConnected();
        console.log("[QB Sync] QuickBooks connected:", qbConnected);
        
        if (qbConnected) {
          // Check if estimate was previously synced
          const { data: mapping } = await supabase
            .from("quickbooks_estimate_mappings")
            .select("quickbooks_estimate_id, sync_status")
            .eq("estimate_id", data.id)
            .maybeSingle();

          console.log("[QB Sync] Estimate mapping found:", mapping);

          if (mapping && mapping.sync_status !== "voided") {
            console.log("[QB Sync] Invoking quickbooks-update-estimate for:", data.id);
            const { data: syncResult, error: syncError } = await supabase.functions.invoke("quickbooks-update-estimate", {
              body: { estimateId: data.id },
            });
            
            if (syncError) {
              console.error("[QB Sync] Edge function error:", syncError);
            } else {
              console.log("[QB Sync] Sync result:", syncResult);
              if (syncResult?.success) {
                console.log("[QB Sync] Estimate successfully synced to QuickBooks");
              } else if (syncResult?.error) {
                console.error("[QB Sync] Sync failed:", syncResult.error);
              }
            }
          } else if (!mapping) {
            console.log("[QB Sync] No existing mapping - estimate not yet synced to QuickBooks");
          } else {
            console.log("[QB Sync] Estimate is voided in QuickBooks, skipping update");
          }
        }
      } catch (qbError) {
        console.error("[QB Sync] QuickBooks update sync error (non-blocking):", qbError);
      }

      return estimateData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["estimates", data.id] });
      queryClient.invalidateQueries({ queryKey: ["estimate-qb-status", data.id] });
      toast.success("Estimate updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update estimate: ${error.message}`);
    },
  });
};

export const useDeleteEstimate = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch current data for logging
      const { data: before } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", id)
        .single();

      // Auto-void in QuickBooks if connected
      try {
        const qbConnected = await isQuickBooksConnected();
        if (qbConnected) {
          console.log("QuickBooks connected - voiding estimate:", id);
          await supabase.functions.invoke("quickbooks-void-estimate", {
            body: { estimateId: id },
          });
        }
      } catch (qbError) {
        console.error("QuickBooks void error (non-blocking):", qbError);
      }
      
      // First, unlink any job orders that reference this estimate
      await supabase
        .from("job_orders")
        .update({ estimate_id: null })
        .eq("estimate_id", id);
      
      // Soft delete instead of hard delete
      const { error } = await supabase
        .from("estimates")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .eq("id", id);

      if (error) throw error;

      // Log the action
      await logAction({
        actionType: "delete",
        resourceType: "estimate",
        resourceId: id,
        resourceNumber: before?.number,
        changesBefore: before as unknown as Json,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["job_orders"] });
      queryClient.invalidateQueries({ queryKey: ["deleted_items"] });
      toast.success("Estimate moved to trash");
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

      // Join with products table to get product names
      const { data: lineItems, error: lineItemsError } = await supabase
        .from("estimate_line_items")
        .select("*, products:product_id(name)")
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

      // Create job order (number generated by DB trigger)
      const { data: jobOrder, error: jobOrderError } = await supabase
        .from("job_orders")
        .insert([
          {
            number: "",
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

      // Create job order line items (preserve is_taxable, product_id, and product_name from estimate)
      const jobOrderLineItems = lineItems.map((item: any) => ({
        job_order_id: jobOrder.id,
        product_id: item.product_id || null,
        product_name: item.product_name || item.products?.name || null,
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

      // Join with products table to get product names and descriptions
      const { data: lineItems, error: lineItemsError } = await supabase
        .from("estimate_line_items")
        .select("*, products:product_id(name, description)")
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

      // Create invoice line items with separated product name and description
      const invoiceLineItems = lineItems.map((item: any) => {
        const productName = item.product_name || item.products?.name || null;
        
        // Clean description: if it starts with the product name (old data), strip it
        let cleanDescription = item.description || "";
        if (productName && cleanDescription.startsWith(productName)) {
          // Remove product name prefix and common separators
          cleanDescription = cleanDescription.slice(productName.length).replace(/^[\s\-:]+/, "").trim();
          // If nothing left, use product description or empty
          if (!cleanDescription) {
            cleanDescription = item.products?.description || "";
          }
        }
        
        return {
          invoice_id: invoice.id,
          product_name: productName,
          description: cleanDescription,
          quantity: item.quantity,
          unit_price: item.unit_price,
          markup: item.markup,
          total: item.total,
        };
      });

      const { error: lineItemsInsertError } = await supabase
        .from("invoice_line_items")
        .insert(invoiceLineItems);

      if (lineItemsInsertError) throw lineItemsInsertError;

      // Sync to QuickBooks if connected
      try {
        const qbConnected = await isQuickBooksConnected();
        if (qbConnected) {
          console.log("QuickBooks connected - syncing invoice from estimate:", invoice.id);
          const { error: qbError } = await supabase.functions.invoke("quickbooks-create-invoice", {
            body: { invoiceId: invoice.id },
          });
          if (qbError) {
            console.error("QuickBooks sync error:", qbError);
            toast.warning("Invoice created, but QuickBooks sync failed");
          }
        }
      } catch (qbError) {
        console.error("QuickBooks sync error (non-blocking):", qbError);
        toast.warning("Invoice created, but QuickBooks sync failed");
      }

      return invoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      toast.success(`Invoice ${invoice.number} created successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to convert estimate to invoice: ${error.message}`);
    },
  });
};

// Hook for importing estimates from QuickBooks
export const useImportEstimatesFromQuickBooks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("quickbooks-import-estimates");

      if (error) {
        throw new Error(error.message || "Failed to import estimates");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as {
        success: boolean;
        totalInQuickBooks: number;
        imported: number;
        skipped: number;
        errors: string[];
        unmappedCustomers: string[];
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      
      if (result.imported > 0) {
        toast.success(`Successfully imported ${result.imported} estimates from QuickBooks`);
      } else if (result.skipped > 0 && result.imported === 0) {
        toast.info(`All ${result.skipped} estimates already exist in Command X`);
      }

      if (result.unmappedCustomers.length > 0) {
        toast.warning(`${result.unmappedCustomers.length} estimates skipped due to unmapped customers`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to import estimates: ${error.message}`);
    },
  });
};

// Check if estimate is synced to QuickBooks
export const useEstimateQuickBooksStatus = (estimateId: string) => {
  return useQuery({
    queryKey: ["estimate-qb-status", estimateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quickbooks_estimate_mappings")
        .select("quickbooks_estimate_id, sync_status, last_synced_at")
        .eq("estimate_id", estimateId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!estimateId,
  });
};

// Manually sync estimate to QuickBooks
export const useSyncEstimateToQuickBooks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (estimateId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "quickbooks-create-estimate",
        { body: { estimateId } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, estimateId) => {
      queryClient.invalidateQueries({ queryKey: ["estimate-qb-status", estimateId] });
      toast.success(data.message || "Estimate synced to QuickBooks!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to sync estimate to QuickBooks");
    },
  });
};
