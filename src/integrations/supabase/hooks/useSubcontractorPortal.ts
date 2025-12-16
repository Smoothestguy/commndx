import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SubcontractorPurchaseOrder {
  id: string;
  number: string;
  project_name: string;
  project_id: string;
  customer_name: string;
  status: string;
  total: number;
  total_addendum_amount: number;
  billed_amount: number;
  revised_total: number;
  billed_to_date: number;
  remaining_to_bill: number;
  due_date: string;
  created_at: string;
}

export interface SubcontractorBill {
  id: string;
  number: string;
  purchase_order_id: string;
  po_number: string;
  status: string;
  total: number;
  bill_date: string;
  due_date: string;
  submitted_at: string | null;
  paid_amount: number;
  remaining_amount: number;
  created_at: string;
}

export interface POBackCharge {
  id: string;
  purchase_order_id: string;
  vendor_id: string;
  charge_type: "deduction" | "penalty" | "adjustment";
  description: string;
  amount: number;
  applied_date: string;
  notes: string | null;
  created_at: string;
}

// Get current subcontractor (vendor where vendor_type='contractor')
export function useCurrentSubcontractor() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["current-subcontractor", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("user_id", user.id)
        .eq("vendor_type", "contractor")
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

// Get purchase orders for current subcontractor
export function useSubcontractorPurchaseOrders() {
  const { data: subcontractor } = useCurrentSubcontractor();
  
  return useQuery({
    queryKey: ["subcontractor-purchase-orders", subcontractor?.id],
    queryFn: async () => {
      if (!subcontractor?.id) return [];
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id,
          number,
          project_name,
          project_id,
          customer_name,
          status,
          total,
          total_addendum_amount,
          billed_amount,
          due_date,
          created_at
        `)
        .eq("vendor_id", subcontractor.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(po => ({
        ...po,
        revised_total: (po.total || 0) + (po.total_addendum_amount || 0),
        billed_to_date: po.billed_amount || 0,
        remaining_to_bill: ((po.total || 0) + (po.total_addendum_amount || 0)) - (po.billed_amount || 0),
      })) as SubcontractorPurchaseOrder[];
    },
    enabled: !!subcontractor?.id,
  });
}

// Get single PO detail for subcontractor
export function useSubcontractorPurchaseOrder(id: string | undefined) {
  const { data: subcontractor } = useCurrentSubcontractor();
  
  return useQuery({
    queryKey: ["subcontractor-purchase-order", id],
    queryFn: async () => {
      if (!id || !subcontractor?.id) return null;
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          po_line_items(*),
          po_addendums(
            *,
            po_addendum_line_items(*)
          )
        `)
        .eq("id", id)
        .eq("vendor_id", subcontractor.id)
        .single();
      
      if (error) throw error;
      
      return {
        ...data,
        revised_total: (data.total || 0) + (data.total_addendum_amount || 0),
        billed_to_date: data.billed_amount || 0,
        remaining_to_bill: ((data.total || 0) + (data.total_addendum_amount || 0)) - (data.billed_amount || 0),
      };
    },
    enabled: !!id && !!subcontractor?.id,
  });
}

// Get back charges for a PO
export function usePOBackCharges(purchaseOrderId: string | undefined) {
  return useQuery({
    queryKey: ["po-back-charges", purchaseOrderId],
    queryFn: async () => {
      if (!purchaseOrderId) return [];
      
      // Using any type since po_back_charges is a newly created table
      const { data, error } = await (supabase as any)
        .from("po_back_charges")
        .select("*")
        .eq("purchase_order_id", purchaseOrderId)
        .order("applied_date", { ascending: false });
      
      if (error) throw error;
      return (data || []) as POBackCharge[];
    },
    enabled: !!purchaseOrderId,
  });
}

// Get all back charges for current subcontractor
export function useSubcontractorBackCharges() {
  const { data: subcontractor } = useCurrentSubcontractor();
  
  return useQuery({
    queryKey: ["subcontractor-back-charges", subcontractor?.id],
    queryFn: async () => {
      if (!subcontractor?.id) return [];
      
      // Using any type since po_back_charges is a newly created table
      const { data, error } = await (supabase as any)
        .from("po_back_charges")
        .select(`
          *,
          purchase_orders(number, project_name)
        `)
        .eq("vendor_id", subcontractor.id)
        .order("applied_date", { ascending: false });
      
      if (error) throw error;
      return (data || []) as POBackCharge[];
    },
    enabled: !!subcontractor?.id,
  });
}

// Get bills for current subcontractor
export function useSubcontractorBills() {
  const { data: subcontractor } = useCurrentSubcontractor();
  
  return useQuery({
    queryKey: ["subcontractor-bills", subcontractor?.id],
    queryFn: async () => {
      if (!subcontractor?.id) return [];
      
      const { data, error } = await supabase
        .from("vendor_bills")
        .select(`
          id,
          number,
          purchase_order_id,
          status,
          total,
          bill_date,
          due_date,
          submitted_at,
          paid_amount,
          remaining_amount,
          created_at,
          purchase_orders!inner(number)
        `)
        .eq("vendor_id", subcontractor.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(bill => ({
        ...bill,
        po_number: (bill.purchase_orders as any)?.number || '',
      })) as SubcontractorBill[];
    },
    enabled: !!subcontractor?.id,
  });
}

// Get single bill detail for subcontractor
export function useSubcontractorBill(id: string | undefined) {
  const { data: subcontractor } = useCurrentSubcontractor();
  
  return useQuery({
    queryKey: ["subcontractor-bill", id],
    queryFn: async () => {
      if (!id || !subcontractor?.id) return null;
      
      const { data, error } = await supabase
        .from("vendor_bills")
        .select(`
          *,
          vendor_bill_line_items(*),
          vendor_bill_payments(*),
          purchase_orders(number, project_name)
        `)
        .eq("id", id)
        .eq("vendor_id", subcontractor.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!subcontractor?.id,
  });
}

// Create bill from subcontractor portal
export function useCreateSubcontractorBill() {
  const queryClient = useQueryClient();
  const { data: subcontractor } = useCurrentSubcontractor();
  
  return useMutation({
    mutationFn: async (billData: {
      purchase_order_id: string;
      bill_date: string;
      due_date: string;
      notes?: string;
      line_items: Array<{
        description: string;
        quantity: number;
        unit_cost: number;
        total: number;
        po_line_item_id?: string;
      }>;
    }) => {
      if (!subcontractor?.id) throw new Error("Subcontractor not found");
      
      const subtotal = billData.line_items.reduce((sum, item) => sum + item.total, 0);
      const subcontractorName = subcontractor.name || "";
      
      // Create the bill
      const { data: bill, error: billError } = await supabase
        .from("vendor_bills")
        .insert({
          vendor_id: subcontractor.id,
          vendor_name: subcontractorName,
          purchase_order_id: billData.purchase_order_id,
          bill_date: billData.bill_date,
          due_date: billData.due_date,
          notes: billData.notes,
          subtotal,
          tax_rate: 0,
          tax_amount: 0,
          total: subtotal,
          status: "open",
          number: "", // Auto-generated
        } as any)
        .select()
        .single();
      
      if (billError) throw billError;
      
      // Create line items
      const lineItemsToInsert = billData.line_items.map(item => ({
        bill_id: bill.id,
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total: item.total,
        po_line_item_id: item.po_line_item_id,
      }));
      
      const { error: lineItemsError } = await supabase
        .from("vendor_bill_line_items")
        .insert(lineItemsToInsert);
      
      if (lineItemsError) throw lineItemsError;
      
      return bill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcontractor-bills"] });
      queryClient.invalidateQueries({ queryKey: ["subcontractor-purchase-orders"] });
      toast.success("Bill submitted successfully");
    },
    onError: (error) => {
      toast.error("Failed to submit bill: " + error.message);
    },
  });
}
