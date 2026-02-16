import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";
import { useAuditLog, computeChanges } from "@/hooks/useAuditLog";
import type { Json } from "../types";

export type VendorBillStatus = "draft" | "open" | "paid" | "partially_paid" | "void";

export interface VendorBillLineItem {
  id?: string;
  bill_id?: string;
  project_id: string | null;
  category_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  total: number;
  po_line_item_id?: string | null;
  po_addendum_line_item_id?: string | null;
  qb_product_mapping_id?: string | null;
  jo_line_item_id?: string | null;
}

export interface VendorBillPayment {
  id: string;
  bill_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  quickbooks_payment_id?: string | null;
}

export interface VendorBill {
  id: string;
  number: string;
  vendor_id: string;
  vendor_name: string;
  bill_date: string;
  due_date: string;
  status: VendorBillStatus;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  notes: string | null;
  purchase_order_id: string | null;
  purchase_order_number: string | null;
  created_at: string;
  updated_at: string;
  line_items?: VendorBillLineItem[];
  payments?: VendorBillPayment[];
}

export interface VendorBillFilters {
  status?: VendorBillStatus;
  vendor_id?: string;
  project_id?: string;
  start_date?: string;
  end_date?: string;
}

// Bulk payment interfaces
export interface BulkBillPaymentItem {
  bill_id: string;
  bill_number: string;
  vendor_name: string;
  remaining_amount: number;
  payment_amount: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string | null;
  notes?: string | null;
}

export interface BulkBillPaymentResult {
  bill_id: string;
  bill_number: string;
  success: boolean;
  error?: string;
  payment_id?: string;
}

// Helper to check if QuickBooks is connected
async function isQuickBooksConnected(): Promise<boolean> {
  const { data } = await supabase
    .from("quickbooks_config")
    .select("is_connected")
    .single();
  return data?.is_connected === true;
}

export const useVendorBills = (filters?: VendorBillFilters) => {
  return useQuery({
    queryKey: ["vendor-bills", filters],
    queryFn: async () => {
      let query = supabase
        .from("vendor_bills")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.vendor_id) {
        query = query.eq("vendor_id", filters.vendor_id);
      }
      if (filters?.start_date) {
        query = query.gte("bill_date", filters.start_date);
      }
      if (filters?.end_date) {
        query = query.lte("bill_date", filters.end_date);
      }

      const { data, error } = await query;
      if (error) throw error;

      // If filtering by project, we need to filter by line items
      if (filters?.project_id) {
        const { data: lineItems, error: lineError } = await supabase
          .from("vendor_bill_line_items")
          .select("bill_id")
          .eq("project_id", filters.project_id);

        if (lineError) throw lineError;
        const billIds = [...new Set(lineItems.map(li => li.bill_id))];
        return (data as VendorBill[]).filter(bill => billIds.includes(bill.id));
      }

      return data as VendorBill[];
    },
  });
};

export const useVendorBill = (id: string | undefined) => {
  return useQuery({
    queryKey: ["vendor-bill", id],
    queryFn: async () => {
      if (!id) return null;

      const { data: bill, error: billError } = await supabase
        .from("vendor_bills")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (billError) throw billError;
      if (!bill) return null;

      const { data: lineItems, error: lineError } = await supabase
        .from("vendor_bill_line_items")
        .select("*")
        .eq("bill_id", id);

      if (lineError) throw lineError;

      const { data: payments, error: paymentError } = await supabase
        .from("vendor_bill_payments")
        .select("*")
        .eq("bill_id", id)
        .order("payment_date", { ascending: false });

      if (paymentError) throw paymentError;

      return {
        ...bill,
        line_items: lineItems,
        payments: payments,
      } as VendorBill;
    },
    enabled: !!id,
  });
};

export const useVendorBillsByProject = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ["vendor-bills-by-project", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data: lineItems, error: lineError } = await supabase
        .from("vendor_bill_line_items")
        .select("bill_id, total, vendor_bills(*)")
        .eq("project_id", projectId);

      if (lineError) throw lineError;

      // Group by bill and sum totals
      const billTotals: Record<string, { bill: VendorBill; allocated_amount: number }> = {};
      lineItems.forEach((item: any) => {
        if (!billTotals[item.bill_id]) {
          billTotals[item.bill_id] = {
            bill: item.vendor_bills,
            allocated_amount: 0,
          };
        }
        billTotals[item.bill_id].allocated_amount += Number(item.total);
      });

      return Object.values(billTotals);
    },
    enabled: !!projectId,
  });
};

export const useVendorBillsByPurchaseOrder = (purchaseOrderId: string | undefined) => {
  return useQuery({
    queryKey: ["vendor-bills-by-po", purchaseOrderId],
    queryFn: async () => {
      if (!purchaseOrderId) return [];

      const { data, error } = await supabase
        .from("vendor_bills")
        .select("*")
        .eq("purchase_order_id", purchaseOrderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as VendorBill[];
    },
    enabled: !!purchaseOrderId,
  });
};

export const useAddVendorBill = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async ({
      bill,
      lineItems,
    }: {
      bill: Omit<VendorBill, "id" | "number" | "created_at" | "updated_at" | "paid_amount" | "remaining_amount" | "line_items" | "payments">;
      lineItems: Omit<VendorBillLineItem, "id" | "bill_id">[];
    }) => {
      // Insert bill (number auto-generated by trigger)
      const { data: newBill, error: billError } = await supabase
        .from("vendor_bills")
        .insert([{
          vendor_id: bill.vendor_id,
          vendor_name: bill.vendor_name,
          bill_date: bill.bill_date,
          due_date: bill.due_date,
          status: bill.status,
          subtotal: bill.subtotal,
          tax_rate: bill.tax_rate,
          tax_amount: bill.tax_amount,
          total: bill.total,
          notes: bill.notes,
          remaining_amount: bill.total,
          purchase_order_id: bill.purchase_order_id,
          purchase_order_number: bill.purchase_order_number,
          number: "", // Will be auto-generated by trigger
        }])
        .select()
        .single();

      if (billError) throw billError;

      // Insert line items
      if (lineItems.length > 0) {
        const { error: lineError } = await supabase
          .from("vendor_bill_line_items")
          .insert(lineItems.map(item => ({
            ...item,
            bill_id: newBill.id,
          })));

        if (lineError) throw lineError;
      }

      // Log the action
      await logAction({
        actionType: "create",
        resourceType: "vendor_bill",
        resourceId: newBill.id,
        resourceNumber: newBill.number,
        changesAfter: { number: newBill.number, vendor_name: newBill.vendor_name, total: newBill.total } as unknown as Json,
      });

      return newBill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bills-by-po"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bills-by-project"] });
      queryClient.invalidateQueries({ queryKey: ["project-labor-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Vendor bill created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create vendor bill: ${error.message}`);
    },
  });
};

export const useUpdateVendorBill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      bill,
      lineItems,
    }: {
      id: string;
      bill: Partial<VendorBill>;
      lineItems: Omit<VendorBillLineItem, "id" | "bill_id">[];
    }) => {
      // Update bill
      const { error: billError } = await supabase
        .from("vendor_bills")
        .update({
          vendor_id: bill.vendor_id,
          vendor_name: bill.vendor_name,
          bill_date: bill.bill_date,
          due_date: bill.due_date,
          status: bill.status,
          subtotal: bill.subtotal,
          tax_rate: bill.tax_rate,
          tax_amount: bill.tax_amount,
          total: bill.total,
          remaining_amount: ((r) => r === 0 ? 0 : r)(Math.round(((bill.total || 0) - (bill.paid_amount || 0)) * 100) / 100),
          notes: bill.notes,
        })
        .eq("id", id);

      if (billError) throw billError;

      // Delete existing line items and re-insert
      const { error: deleteError } = await supabase
        .from("vendor_bill_line_items")
        .delete()
        .eq("bill_id", id);

      if (deleteError) throw deleteError;

      if (lineItems.length > 0) {
        const { error: lineError } = await supabase
          .from("vendor_bill_line_items")
          .insert(lineItems.map(item => ({
            ...item,
            bill_id: id,
          })));

        if (lineError) throw lineError;
      }

      // Auto-sync to QuickBooks if connected and bill was previously synced
      let qbSyncFailed = false;
      let qbErrorMessage = "";
      try {
        const qbConnected = await isQuickBooksConnected();
        if (qbConnected) {
          // Check if bill was previously synced
          const { data: mapping } = await supabase
            .from("quickbooks_bill_mappings")
            .select("quickbooks_bill_id, sync_status")
            .eq("bill_id", id)
            .maybeSingle();

          if (mapping && mapping.sync_status !== "voided" && mapping.quickbooks_bill_id) {
            console.log("QuickBooks connected - updating bill:", id);
            const { error: syncError } = await supabase.functions.invoke("quickbooks-update-bill", {
              body: { billId: id },
            });
            if (syncError) {
              qbSyncFailed = true;
              qbErrorMessage = syncError.message || "Unknown sync error";
              console.error("QuickBooks sync returned error:", syncError);
            }
          }
        }
      } catch (qbError) {
        console.error("QuickBooks update sync error (non-blocking):", qbError);
        qbSyncFailed = true;
        qbErrorMessage = qbError instanceof Error ? qbError.message : "Unknown error";
        // Don't throw - QB sync failure shouldn't prevent bill update
      }

      return { id, qbSyncFailed, qbErrorMessage };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bill", result.id] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bills-by-po"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-bill-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-bill-mapping", result.id] });
      
      if (result.qbSyncFailed) {
        toast.warning("Bill saved, but QuickBooks sync failed. Check sync status.");
        console.error("QuickBooks sync error details:", result.qbErrorMessage);
      } else {
        toast.success("Vendor bill updated successfully");
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to update vendor bill: ${error.message}`);
    },
  });
};

export const useDeleteVendorBill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Void/delete in QuickBooks first
      let qbVoidResult: { success: boolean; error?: string } = { success: true };
      try {
        const qbConnected = await isQuickBooksConnected();
        if (qbConnected) {
          console.log("[VendorBill] QuickBooks connected - voiding vendor bill:", id);
          const { data, error } = await supabase.functions.invoke("quickbooks-void-bill", {
            body: { billId: id },
          });
          
          if (error) {
            console.error("[VendorBill] QB void function invocation error:", error);
            qbVoidResult = { success: false, error: error.message };
          } else if (data && !data.success) {
            console.error("[VendorBill] QB void returned failure:", data.error);
            qbVoidResult = { success: false, error: data.error };
          } else {
            console.log("[VendorBill] QB void successful:", data);
          }
        }
      } catch (qbError) {
        console.error("[VendorBill] QuickBooks void error:", qbError);
        qbVoidResult = { success: false, error: qbError instanceof Error ? qbError.message : "Unknown error" };
      }
      
      // Soft delete
      const { error } = await supabase
        .from("vendor_bills")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .eq("id", id);

      if (error) throw error;
      
      return qbVoidResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bills-by-po"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["deleted_items"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-bill-mappings"] });
      
      if (result && !result.success) {
        toast.warning(`Bill deleted locally, but QuickBooks void failed: ${result.error}`);
      } else {
        toast.success("Vendor bill moved to trash");
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete vendor bill: ${error.message}`);
    },
  });
};

export const useAddVendorBillPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: Omit<VendorBillPayment, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("vendor_bill_payments")
        .insert([payment])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bill", data.bill_id] });
      toast.success("Payment recorded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });
};

export const useDeleteVendorBillPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, billId }: { id: string; billId: string }) => {
      const { error } = await supabase
        .from("vendor_bill_payments")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return billId;
    },
    onSuccess: (billId) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bill", billId] });
      toast.success("Payment deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete payment: ${error.message}`);
    },
  });
};

// Bulk payment hook for vendor bills
export const useBulkAddVendorBillPayments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payments: BulkBillPaymentItem[]): Promise<BulkBillPaymentResult[]> => {
      const results: BulkBillPaymentResult[] = [];

      for (const payment of payments) {
        try {
          // Validate payment amount
          if (payment.payment_amount <= 0) {
            results.push({
              bill_id: payment.bill_id,
              bill_number: payment.bill_number,
              success: false,
              error: "Payment amount must be greater than 0",
            });
            continue;
          }

          if (payment.payment_amount > payment.remaining_amount) {
            results.push({
              bill_id: payment.bill_id,
              bill_number: payment.bill_number,
              success: false,
              error: "Payment amount exceeds remaining balance",
            });
            continue;
          }

          // Insert payment
          const { data: insertedPayment, error: paymentError } = await supabase
            .from("vendor_bill_payments")
            .insert([{
              bill_id: payment.bill_id,
              amount: payment.payment_amount,
              payment_date: payment.payment_date,
              payment_method: payment.payment_method,
              reference_number: payment.reference_number || null,
              notes: payment.notes || null,
            }])
            .select()
            .single();

          if (paymentError) {
            results.push({
              bill_id: payment.bill_id,
              bill_number: payment.bill_number,
              success: false,
              error: paymentError.message,
            });
            continue;
          }

          results.push({
            bill_id: payment.bill_id,
            bill_number: payment.bill_number,
            success: true,
            payment_id: insertedPayment.id,
          });
        } catch (error) {
          results.push({
            bill_id: payment.bill_id,
            bill_number: payment.bill_number,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bill"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });

      if (successCount > 0 && failCount === 0) {
        toast.success(`Successfully recorded ${successCount} payment${successCount > 1 ? 's' : ''}`);
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`Recorded ${successCount} payment${successCount > 1 ? 's' : ''}, ${failCount} failed`);
      } else if (failCount > 0) {
        toast.error(`Failed to record ${failCount} payment${failCount > 1 ? 's' : ''}`);
      }
    },
  });
};

// Hard delete vendor bill - permanently removes bill and all related data
export const useHardDeleteVendorBill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log("[VendorBill] Starting hard delete for:", id);

      // Check if QuickBooks is connected and try to void there first
      try {
        const qbConnected = await isQuickBooksConnected();
        if (qbConnected) {
          console.log("[VendorBill] QB connected - voiding bill before hard delete:", id);
          const { data, error } = await supabase.functions.invoke("quickbooks-void-bill", {
            body: { billId: id },
          });
          if (error) {
            console.error("[VendorBill] QB void invocation error during hard delete:", error);
          } else if (data && !data.success) {
            console.error("[VendorBill] QB void returned failure during hard delete:", data.error);
          } else {
            console.log("[VendorBill] QB void successful during hard delete:", data);
          }
        }
      } catch (qbError) {
        console.error("[VendorBill] QuickBooks void error (non-blocking):", qbError);
      }

      // 1. Get all payment IDs for this bill to delete their attachments
      const { data: payments } = await supabase
        .from("vendor_bill_payments")
        .select("id")
        .eq("bill_id", id);

      // 2. Delete payment attachments
      if (payments && payments.length > 0) {
        const paymentIds = payments.map(p => p.id);
        const { error: paymentAttachError } = await supabase
          .from("vendor_bill_payment_attachments")
          .delete()
          .in("payment_id", paymentIds);
        
        if (paymentAttachError) {
          console.error("Error deleting payment attachments:", paymentAttachError);
        }
      }

      // 3. Delete payments
      const { error: paymentsError } = await supabase
        .from("vendor_bill_payments")
        .delete()
        .eq("bill_id", id);
      
      if (paymentsError) {
        console.error("Error deleting payments:", paymentsError);
      }

      // 4. Delete bill attachments
      const { error: attachError } = await supabase
        .from("vendor_bill_attachments")
        .delete()
        .eq("bill_id", id);
      
      if (attachError) {
        console.error("Error deleting attachments:", attachError);
      }

      // 5. Delete line items
      const { error: lineItemsError } = await supabase
        .from("vendor_bill_line_items")
        .delete()
        .eq("bill_id", id);
      
      if (lineItemsError) {
        console.error("Error deleting line items:", lineItemsError);
      }

      // 6. Delete change order links
      const { error: coLinksError } = await supabase
        .from("change_order_vendor_bills")
        .delete()
        .eq("vendor_bill_id", id);
      
      if (coLinksError) {
        console.error("Error deleting change order links:", coLinksError);
      }

      // 7. Delete QuickBooks mapping
      const { error: mappingError } = await supabase
        .from("quickbooks_bill_mappings")
        .delete()
        .eq("bill_id", id);
      
      if (mappingError) {
        console.error("Error deleting QB mapping:", mappingError);
      }

      // 8. Finally delete the bill itself
      const { error } = await supabase
        .from("vendor_bills")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bills-by-po"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["deleted_items"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-bill-mappings"] });
      toast.success("Vendor bill permanently deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to permanently delete: ${error.message}`);
    },
  });
};
