import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

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

      // Auto-sync to QuickBooks if connected
      try {
        const qbConnected = await isQuickBooksConnected();
        if (qbConnected) {
          console.log("QuickBooks connected - syncing vendor bill:", newBill.id);
          await supabase.functions.invoke("quickbooks-create-bill", {
            body: { billId: newBill.id },
          });
        }
      } catch (qbError) {
        console.error("QuickBooks sync error (non-blocking):", qbError);
        // Don't throw - QB sync failure shouldn't prevent bill creation
      }

      return newBill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bills-by-po"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
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
          remaining_amount: (bill.total || 0) - (bill.paid_amount || 0),
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

      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bill", id] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bills-by-po"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Vendor bill updated successfully");
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
      const { error } = await supabase
        .from("vendor_bills")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bills-by-po"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Vendor bill deleted successfully");
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
