import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  total: number;
}

export interface Invoice {
  id: string;
  number: string;
  job_order_id?: string;
  job_order_number?: string;
  estimate_id?: string;
  customer_id: string;
  customer_name: string;
  project_name?: string;
  status: "draft" | "sent" | "paid" | "overdue";
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  due_date: string;
  paid_date?: string;
  created_at: string;
}

export interface InvoiceWithLineItems extends Invoice {
  line_items: InvoiceLineItem[];
}

export const useInvoices = () => {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
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
        .eq("invoice_id", id);

      if (lineItemsError) throw lineItemsError;

      return {
        ...invoice,
        line_items: lineItems,
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
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!jobOrderId,
  });
};

export const useAddInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoice: Omit<InvoiceWithLineItems, "id" | "created_at">) => {
      // Insert invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          number: invoice.number,
          job_order_id: invoice.job_order_id,
          job_order_number: invoice.job_order_number,
          estimate_id: invoice.estimate_id,
          customer_id: invoice.customer_id,
          customer_name: invoice.customer_name,
          project_name: invoice.project_name,
          status: invoice.status,
          subtotal: invoice.subtotal,
          tax_rate: invoice.tax_rate,
          tax_amount: invoice.tax_amount,
          total: invoice.total,
          due_date: invoice.due_date,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert line items
      if (invoice.line_items.length > 0) {
        const lineItemsToInsert = invoice.line_items.map((item) => ({
          invoice_id: newInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          markup: item.markup,
          total: item.total,
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

      return newInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["job_orders"] });
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
        .select("total, job_order_id")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Update invoice
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          status: invoice.status,
          subtotal: invoice.subtotal,
          tax_rate: invoice.tax_rate,
          tax_amount: invoice.tax_amount,
          total: invoice.total,
          due_date: invoice.due_date,
          paid_date: invoice.paid_date,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Update line items if provided
      if (invoice.line_items) {
        await supabase.from("invoice_line_items").delete().eq("invoice_id", id);

        if (invoice.line_items.length > 0) {
          const lineItemsToInsert = invoice.line_items.map((item) => ({
            invoice_id: id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            markup: item.markup,
            total: item.total,
          }));

          const { error: lineItemsError } = await supabase
            .from("invoice_line_items")
            .insert(lineItemsToInsert);

          if (lineItemsError) throw lineItemsError;
        }
      }

      // Update job order balance if total changed
      if (oldInvoice.job_order_id && invoice.total && invoice.total !== oldInvoice.total) {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["job_orders"] });
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

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: invoice, error: fetchError } = await supabase
        .from("invoices")
        .select("total, job_order_id")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Restore job order balance
      if (invoice.job_order_id) {
        const { data: jobOrder, error: jobFetchError } = await supabase
          .from("job_orders")
          .select("invoiced_amount, remaining_amount")
          .eq("id", invoice.job_order_id)
          .single();

        if (jobFetchError) throw jobFetchError;

        const { error: updateError } = await supabase
          .from("job_orders")
          .update({
            invoiced_amount: jobOrder.invoiced_amount - invoice.total,
            remaining_amount: jobOrder.remaining_amount + invoice.total,
          })
          .eq("id", invoice.job_order_id);

        if (updateError) throw updateError;
      }

      // Delete line items
      await supabase.from("invoice_line_items").delete().eq("invoice_id", id);

      // Delete invoice
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["job_orders"] });
      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });
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
