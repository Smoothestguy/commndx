import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuditLog, computeChanges } from "@/hooks/useAuditLog";
import type { Json } from "../types";

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  jo_line_item_id?: string;
  product_id?: string;
  product_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  total: number;
  display_order?: number;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  quickbooks_payment_id?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  number: string;
  job_order_id?: string;
  job_order_number?: string;
  estimate_id?: string;
  change_order_id?: string;
  project_id?: string;
  customer_id: string;
  customer_name: string;
  project_name?: string;
  status: "draft" | "sent" | "partially_paid" | "paid" | "overdue";
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string;
  paid_date?: string;
  notes?: string;
  created_at: string;
}

export interface InvoiceWithLineItems extends Invoice {
  line_items: InvoiceLineItem[];
  payments?: InvoicePayment[];
}

export const useInvoices = () => {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    },
  });
};

export const useInvoice = (id: string) => {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => {
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .single();

      if (invoiceError) throw invoiceError;

      const { data: lineItems, error: lineItemsError } = await supabase
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", id)
        .order("display_order", { ascending: true, nullsFirst: false });

      if (lineItemsError) throw lineItemsError;

      // Fetch payments
      const { data: payments, error: paymentsError } = await supabase
        .from("invoice_payments")
        .select("*")
        .eq("invoice_id", id)
        .order("payment_date", { ascending: false });

      if (paymentsError) throw paymentsError;

      return {
        ...invoice,
        line_items: lineItems,
        payments: payments || [],
      } as InvoiceWithLineItems;
    },
    enabled: !!id,
  });
};

export const useInvoicesByJobOrder = (jobOrderId: string) => {
  return useQuery({
    queryKey: ["invoices", "job_order", jobOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("job_order_id", jobOrderId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!jobOrderId,
  });
};

export const useAddInvoice = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (
      invoice: Omit<
        InvoiceWithLineItems,
        "id" | "created_at" | "paid_amount" | "remaining_amount" | "payments"
      >
    ) => {
      // Insert invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          number: invoice.number,
          job_order_id: invoice.job_order_id,
          job_order_number: invoice.job_order_number,
          estimate_id: invoice.estimate_id,
          project_id: invoice.project_id,
          customer_id: invoice.customer_id,
          customer_name: invoice.customer_name,
          project_name: invoice.project_name,
          status: invoice.status,
          subtotal: invoice.subtotal,
          tax_rate: invoice.tax_rate,
          tax_amount: invoice.tax_amount,
          total: invoice.total,
          due_date: invoice.due_date,
          notes: invoice.notes,
          remaining_amount: invoice.total, // Initialize remaining to total
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert line items
      if (invoice.line_items.length > 0) {
        const lineItemsToInsert = invoice.line_items.map((item, index) => ({
          invoice_id: newInvoice.id,
          jo_line_item_id: item.jo_line_item_id || null,
          product_id: item.product_id || null,
          product_name: item.product_name || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          markup: item.markup,
          total: item.total,
          display_order: item.display_order ?? index,
        }));

        const { error: lineItemsError } = await supabase
          .from("invoice_line_items")
          .insert(lineItemsToInsert);

        if (lineItemsError) throw lineItemsError;
      }

      // Update job order balance if linked to a job order
      if (invoice.job_order_id) {
        const { data: jobOrder, error: fetchError } = await supabase
          .from("job_orders")
          .select("invoiced_amount, remaining_amount")
          .eq("id", invoice.job_order_id)
          .single();

        if (fetchError) throw fetchError;

        const { error: updateError } = await supabase
          .from("job_orders")
          .update({
            invoiced_amount: jobOrder.invoiced_amount + invoice.total,
            remaining_amount: jobOrder.remaining_amount - invoice.total,
          })
          .eq("id", invoice.job_order_id);

        if (updateError) throw updateError;
      }

      // Log the action
      await logAction({
        actionType: "create",
        resourceType: "invoice",
        resourceId: newInvoice.id,
        resourceNumber: newInvoice.number,
        changesAfter: {
          number: newInvoice.number,
          customer_name: newInvoice.customer_name,
          total: newInvoice.total,
          status: newInvoice.status,
          line_items_count: invoice.line_items.length,
        } as unknown as Json,
      });

      // Auto-sync to QuickBooks if connected
      try {
        const { data: qbConfig } = await supabase
          .from("quickbooks_config")
          .select("is_connected")
          .single();

        if (qbConfig?.is_connected) {
          await supabase.functions.invoke("quickbooks-create-invoice", {
            body: { invoiceId: newInvoice.id },
          });
        }
      } catch (qbError) {
        // Log but don't fail the invoice creation
        console.error("QuickBooks sync failed:", qbError);
      }

      return newInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["job_orders"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      toast({
        title: "Success",
        description: "Invoice created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create invoice: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateInvoice = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async ({
      id,
      invoice,
    }: {
      id: string;
      invoice: Partial<InvoiceWithLineItems>;
    }) => {
      const { data: oldInvoice, error: fetchError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Update invoice
      const { data: updatedInvoice, error: updateError } = await supabase
        .from("invoices")
        .update({
          customer_id: invoice.customer_id ?? oldInvoice.customer_id,
          customer_name: invoice.customer_name ?? oldInvoice.customer_name,
          project_id: invoice.project_id !== undefined ? invoice.project_id : oldInvoice.project_id,
          project_name: invoice.project_name !== undefined ? invoice.project_name : oldInvoice.project_name,
          status: invoice.status ?? oldInvoice.status,
          subtotal: invoice.subtotal ?? oldInvoice.subtotal,
          tax_rate: invoice.tax_rate ?? oldInvoice.tax_rate,
          tax_amount: invoice.tax_amount ?? oldInvoice.tax_amount,
          total: invoice.total ?? oldInvoice.total,
          due_date: invoice.due_date ?? oldInvoice.due_date,
          paid_date: invoice.paid_date,
          notes: invoice.notes !== undefined ? invoice.notes : oldInvoice.notes,
          customer_po: (invoice as any).customer_po !== undefined ? (invoice as any).customer_po : oldInvoice.customer_po,
          remaining_amount: invoice.total !== undefined 
            ? invoice.total - (oldInvoice.paid_amount || 0) 
            : oldInvoice.remaining_amount,
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update line items if provided
      if (invoice.line_items) {
        await supabase.from("invoice_line_items").delete().eq("invoice_id", id);

        if (invoice.line_items.length > 0) {
          const lineItemsToInsert = invoice.line_items.map((item, index) => ({
            invoice_id: id,
            jo_line_item_id: item.jo_line_item_id || null,
            product_id: item.product_id || null,
            product_name: item.product_name || null,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            markup: item.markup,
            total: item.total,
            display_order: item.display_order ?? index,
          }));

          const { error: lineItemsError } = await supabase
            .from("invoice_line_items")
            .insert(lineItemsToInsert);

          if (lineItemsError) throw lineItemsError;
        }
      }

      // Log the action with changes
      const { changesBefore, changesAfter } = computeChanges(
        oldInvoice as Record<string, unknown>,
        updatedInvoice as Record<string, unknown>
      );
      await logAction({
        actionType: "update",
        resourceType: "invoice",
        resourceId: id,
        resourceNumber: updatedInvoice.number,
        changesBefore,
        changesAfter,
      });

      // Update job order balance if total changed
      if (
        oldInvoice.job_order_id &&
        invoice.total &&
        invoice.total !== oldInvoice.total
      ) {
        const { data: jobOrder, error: jobFetchError } = await supabase
          .from("job_orders")
          .select("invoiced_amount, remaining_amount")
          .eq("id", oldInvoice.job_order_id)
          .single();

        if (jobFetchError) throw jobFetchError;

        const difference = invoice.total - oldInvoice.total;

        const { error: jobUpdateError } = await supabase
          .from("job_orders")
          .update({
            invoiced_amount: jobOrder.invoiced_amount + difference,
            remaining_amount: jobOrder.remaining_amount - difference,
          })
          .eq("id", oldInvoice.job_order_id);

        if (jobUpdateError) throw jobUpdateError;
      }

      // Auto-sync to QuickBooks if connected and invoice is mapped
      try {
        const { data: qbConfig } = await supabase
          .from("quickbooks_config")
          .select("is_connected")
          .single();

        if (qbConfig?.is_connected) {
          const { data: mapping } = await supabase
            .from("quickbooks_invoice_mappings")
            .select("quickbooks_invoice_id, sync_status")
            .eq("invoice_id", id)
            .maybeSingle();

          if (mapping && !["deleted", "voided", "error"].includes(mapping.sync_status || "")) {
            await supabase.functions.invoke("quickbooks-update-invoice", {
              body: { invoiceId: id },
            });
          }
        }
      } catch (qbError) {
        // Log but don't fail the invoice update
        console.error("QuickBooks sync failed:", qbError);
      }

      return updatedInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["job_orders"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      toast({
        title: "Success",
        description: "Invoice updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update invoice: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteInvoice = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (
      id: string
    ): Promise<{ qbVoided: boolean; qbError?: string }> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: invoice, error: fetchError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Skip if already deleted (prevents double-restore of job order balance)
      if (invoice.deleted_at) {
        throw new Error("Invoice has already been deleted");
      }

      // Try to void in QuickBooks first (if synced)
      let qbVoided = false;
      let qbError: string | undefined;

      try {
        const { data: voidResult, error: voidError } =
          await supabase.functions.invoke("quickbooks-void-invoice", {
            body: { invoiceId: id },
          });

        if (voidError) {
          console.warn("QuickBooks void error:", voidError);
          qbError = voidError.message || "Failed to void in QuickBooks";
        } else if (voidResult?.voided) {
          qbVoided = true;
          console.log("Invoice voided in QuickBooks");
        } else if (voidResult?.error) {
          qbError = voidResult.error;
          console.warn("QuickBooks void returned error:", qbError);
        }
      } catch (err) {
        console.warn("QuickBooks void exception:", err);
        qbError =
          err instanceof Error ? err.message : "Unknown QuickBooks error";
      }

      // Restore job order balance
      if (invoice.job_order_id) {
        const { data: jobOrder, error: jobFetchError } = await supabase
          .from("job_orders")
          .select("invoiced_amount, remaining_amount, total")
          .eq("id", invoice.job_order_id)
          .single();

        if (!jobFetchError && jobOrder) {
          // Use Math.max/min to prevent negative values or exceeding total
          const newInvoicedAmount = Math.max(
            0,
            jobOrder.invoiced_amount - invoice.total
          );
          const newRemainingAmount = Math.min(
            jobOrder.total,
            jobOrder.remaining_amount + invoice.total
          );

          const { error: updateError } = await supabase
            .from("job_orders")
            .update({
              invoiced_amount: newInvoicedAmount,
              remaining_amount: newRemainingAmount,
            })
            .eq("id", invoice.job_order_id);

          if (updateError) throw updateError;
        }
      }

      // Restore change order balance
      if (invoice.change_order_id) {
        const { data: changeOrder, error: coFetchError } = await supabase
          .from("change_orders")
          .select("invoiced_amount, remaining_amount, total")
          .eq("id", invoice.change_order_id)
          .single();

        if (!coFetchError && changeOrder) {
          // Use Math.max/min to prevent negative values or exceeding total
          const newInvoicedAmount = Math.max(
            0,
            changeOrder.invoiced_amount - invoice.total
          );
          const newRemainingAmount = Math.min(
            changeOrder.total,
            changeOrder.remaining_amount + invoice.total
          );

          const { error: coUpdateError } = await supabase
            .from("change_orders")
            .update({
              invoiced_amount: newInvoicedAmount,
              remaining_amount: newRemainingAmount,
            })
            .eq("id", invoice.change_order_id);

          if (coUpdateError) {
            console.error(
              "Failed to restore change order balance:",
              coUpdateError
            );
          }
        }
      }

      // Soft delete instead of hard delete
      const { error } = await supabase
        .from("invoices")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .eq("id", id);

      if (error) throw error;

      // Log the action
      await logAction({
        actionType: "delete",
        resourceType: "invoice",
        resourceId: id,
        resourceNumber: invoice.number,
        changesBefore: invoice as unknown as Json,
      });

      return { qbVoided, qbError };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["job_orders"] });
      queryClient.invalidateQueries({ queryKey: ["deleted_items"] });

      if (result.qbVoided) {
        toast({
          title: "Success",
          description: "Invoice voided in QuickBooks and moved to trash",
        });
      } else if (result.qbError) {
        toast({
          title: "Invoice Deleted",
          description: `Invoice moved to trash. Note: ${result.qbError}`,
          variant: "default",
        });
      } else {
        toast({
          title: "Success",
          description: "Invoice moved to trash",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete invoice: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useMarkInvoicePaid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({
        title: "Success",
        description: "Invoice marked as paid",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to mark invoice as paid: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

// Helper function to update invoice paid amounts
const updateInvoicePaidAmounts = async (invoiceId: string) => {
  // Get the invoice total
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("total")
    .eq("id", invoiceId)
    .single();

  if (invoiceError) throw invoiceError;

  // Get all payments for this invoice
  const { data: payments, error: paymentsError } = await supabase
    .from("invoice_payments")
    .select("amount")
    .eq("invoice_id", invoiceId);

  if (paymentsError) throw paymentsError;

  const totalPaidAmount =
    payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const remainingAmount = Number(invoice.total) - totalPaidAmount;

  // Determine the new status
  let newStatus: "draft" | "sent" | "partially_paid" | "paid" | "overdue" =
    "sent";
  if (totalPaidAmount >= Number(invoice.total)) {
    newStatus = "paid";
  } else if (totalPaidAmount > 0) {
    newStatus = "partially_paid";
  }

  // Update the invoice
  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      paid_amount: totalPaidAmount,
      remaining_amount: remainingAmount,
      status: newStatus,
      paid_date:
        newStatus === "paid" ? new Date().toISOString().split("T")[0] : null,
    })
    .eq("id", invoiceId);

  if (updateError) throw updateError;
};

// New payment hooks
export const useAddInvoicePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: {
      invoice_id: string;
      payment_date: string;
      amount: number;
      payment_method: string;
      reference_number?: string | null;
      notes?: string | null;
    }) => {
      const { data: newPayment, error } = await supabase
        .from("invoice_payments")
        .insert(payment)
        .select()
        .single();

      if (error) throw error;

      // Update invoice paid amounts
      await updateInvoicePaidAmounts(payment.invoice_id);

      return newPayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to record payment: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateInvoicePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      invoiceId,
      updates,
    }: {
      paymentId: string;
      invoiceId: string;
      updates: {
        payment_date?: string;
        amount?: number;
        payment_method?: string;
        reference_number?: string | null;
        notes?: string | null;
      };
    }) => {
      const { error } = await supabase
        .from("invoice_payments")
        .update(updates)
        .eq("id", paymentId);

      if (error) throw error;

      // Update invoice paid amounts
      await updateInvoicePaidAmounts(invoiceId);
    },
    onSuccess: (_, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({
        title: "Success",
        description: "Payment updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update payment: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteInvoicePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      invoiceId,
    }: {
      paymentId: string;
      invoiceId: string;
    }) => {
      const { error } = await supabase
        .from("invoice_payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;

      // Update invoice paid amounts
      await updateInvoicePaidAmounts(invoiceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({
        title: "Success",
        description: "Payment deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete payment: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

// Bulk payment interface
export interface BulkPaymentItem {
  invoice_id: string;
  invoice_number: string;
  customer_name: string;
  remaining_amount: number;
  payment_amount: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string | null;
  notes?: string | null;
}

export interface BulkPaymentResult {
  invoice_id: string;
  invoice_number: string;
  success: boolean;
  error?: string;
  payment_id?: string;
}

// Bulk add invoice payments hook
export const useBulkAddInvoicePayments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payments: BulkPaymentItem[]
    ): Promise<BulkPaymentResult[]> => {
      const results: BulkPaymentResult[] = [];

      // Process each payment
      for (const payment of payments) {
        try {
          // Validate payment amount
          if (payment.payment_amount <= 0) {
            results.push({
              invoice_id: payment.invoice_id,
              invoice_number: payment.invoice_number,
              success: false,
              error: "Payment amount must be greater than 0",
            });
            continue;
          }

          if (payment.payment_amount > payment.remaining_amount) {
            results.push({
              invoice_id: payment.invoice_id,
              invoice_number: payment.invoice_number,
              success: false,
              error: "Payment amount exceeds remaining balance",
            });
            continue;
          }

          // Insert payment
          const { data: newPayment, error } = await supabase
            .from("invoice_payments")
            .insert({
              invoice_id: payment.invoice_id,
              payment_date: payment.payment_date,
              amount: payment.payment_amount,
              payment_method: payment.payment_method,
              reference_number: payment.reference_number,
              notes: payment.notes,
            })
            .select()
            .single();

          if (error) throw error;

          // Update invoice paid amounts
          await updateInvoicePaidAmounts(payment.invoice_id);

          results.push({
            invoice_id: payment.invoice_id,
            invoice_number: payment.invoice_number,
            success: true,
            payment_id: newPayment?.id,
          });
        } catch (err: any) {
          results.push({
            invoice_id: payment.invoice_id,
            invoice_number: payment.invoice_number,
            success: false,
            error: err.message || "Unknown error",
          });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (failCount === 0) {
        toast({
          title: "Success",
          description: `${successCount} payment(s) recorded successfully`,
        });
      } else if (successCount === 0) {
        toast({
          title: "Error",
          description: `All ${failCount} payment(s) failed`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Partial Success",
          description: `${successCount} payment(s) recorded, ${failCount} failed`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to record payments: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};
