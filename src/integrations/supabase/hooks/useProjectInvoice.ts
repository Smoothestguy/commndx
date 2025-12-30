import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ProjectInvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  total: number;
  display_order: number;
  product_name?: string | null;
  product_id?: string | null;
}

interface AddProjectInvoiceParams {
  number: string;
  project_id: string;
  project_name: string;
  customer_id: string;
  customer_name: string;
  status: "draft" | "sent";
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  due_date: string;
  line_items: ProjectInvoiceLineItem[];
  job_order_ids: string[];
  change_order_ids: string[];
  tm_ticket_ids: string[];
  notes?: string;
  customer_po?: string;
}

export const useAddProjectInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AddProjectInvoiceParams) => {
      const {
        line_items,
        job_order_ids,
        change_order_ids,
        tm_ticket_ids,
        notes,
        customer_po,
        ...invoiceData
      } = params;

      // For multiple items, we'll create one invoice with all line items
      // and link to the first of each type for backwards compatibility
      const firstJobOrderId = job_order_ids.length > 0 ? job_order_ids[0] : null;
      const firstChangeOrderId = change_order_ids.length > 0 ? change_order_ids[0] : null;
      const firstTMTicketId = tm_ticket_ids.length > 0 ? tm_ticket_ids[0] : null;

      // Insert the invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          ...invoiceData,
          job_order_id: firstJobOrderId,
          change_order_id: firstChangeOrderId,
          tm_ticket_id: firstTMTicketId,
          remaining_amount: invoiceData.total,
          notes: notes || null,
          customer_po: customer_po || null,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert line items
      if (line_items.length > 0) {
        const lineItemsToInsert = line_items.map((item) => ({
          invoice_id: newInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          markup: item.markup,
          total: item.total,
          display_order: item.display_order,
          product_name: item.product_name ?? null,
          product_id: item.product_id ?? null,
        }));

        const { error: lineItemsError } = await supabase
          .from("invoice_line_items")
          .insert(lineItemsToInsert);

        if (lineItemsError) throw lineItemsError;
      }

      // Update T&M tickets status to 'invoiced'
      if (tm_ticket_ids.length > 0) {
        const { error: tmUpdateError } = await supabase
          .from("tm_tickets")
          .update({ status: "invoiced" })
          .in("id", tm_ticket_ids);

        if (tmUpdateError) {
          console.error("Failed to update T&M ticket status:", tmUpdateError);
        }
      }

      // Update change order amounts (partial invoicing support)
      for (const changeOrderId of change_order_ids) {
        const { data: changeOrder, error: coFetchError } = await supabase
          .from("change_orders")
          .select("invoiced_amount, remaining_amount, total")
          .eq("id", changeOrderId)
          .single();

        if (coFetchError) {
          console.error("Failed to fetch change order:", coFetchError);
          continue;
        }

        // Invoice the full remaining amount for now
        const amountInvoiced = changeOrder.remaining_amount;

        const { error: coUpdateError } = await supabase
          .from("change_orders")
          .update({
            invoiced_amount: changeOrder.invoiced_amount + amountInvoiced,
            remaining_amount: 0,
          })
          .eq("id", changeOrderId);

        if (coUpdateError) {
          console.error("Failed to update change order amounts:", coUpdateError);
        }
      }

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
        console.error("QuickBooks sync failed:", qbError);
      }

      return newInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["job-orders"] });
      queryClient.invalidateQueries({ queryKey: ["tm-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["change-orders"] });
      queryClient.invalidateQueries({ queryKey: ["project-billable-items"] });
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
