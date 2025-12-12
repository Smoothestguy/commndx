import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface VendorPurchaseOrder {
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

export interface VendorBill {
  id: string;
  number: string;
  purchase_order_id: string;
  po_number: string;
  status: string;
  total: number;
  bill_date: string;
  due_date: string;
  submitted_at: string | null;
  created_at: string;
}

export interface VendorInvitation {
  id: string;
  vendor_id: string;
  email: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
  vendor?: {
    id: string;
    name: string;
    email: string;
  };
}

// Get current vendor record for logged-in user
export function useCurrentVendor() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["current-vendor", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

// Get purchase orders for current vendor
export function useVendorPurchaseOrders() {
  const { data: vendor } = useCurrentVendor();
  
  return useQuery({
    queryKey: ["vendor-purchase-orders", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      
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
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Calculate derived fields
      return (data || []).map(po => ({
        ...po,
        revised_total: (po.total || 0) + (po.total_addendum_amount || 0),
        billed_to_date: po.billed_amount || 0,
        remaining_to_bill: ((po.total || 0) + (po.total_addendum_amount || 0)) - (po.billed_amount || 0),
      })) as VendorPurchaseOrder[];
    },
    enabled: !!vendor?.id,
  });
}

// Get vendor bills for current vendor
export function useVendorBills() {
  const { data: vendor } = useCurrentVendor();
  
  return useQuery({
    queryKey: ["vendor-bills-portal", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      
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
          created_at,
          purchase_orders!inner(number)
        `)
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(bill => ({
        ...bill,
        po_number: (bill.purchase_orders as any)?.number || '',
      })) as VendorBill[];
    },
    enabled: !!vendor?.id,
  });
}

// Get single PO detail for vendor
export function useVendorPurchaseOrder(id: string | undefined) {
  const { data: vendor } = useCurrentVendor();
  
  return useQuery({
    queryKey: ["vendor-purchase-order", id],
    queryFn: async () => {
      if (!id || !vendor?.id) return null;
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          po_line_items(*),
          po_addendums(*)
        `)
        .eq("id", id)
        .eq("vendor_id", vendor.id)
        .single();
      
      if (error) throw error;
      
      return {
        ...data,
        revised_total: (data.total || 0) + (data.total_addendum_amount || 0),
        billed_to_date: data.billed_amount || 0,
        remaining_to_bill: ((data.total || 0) + (data.total_addendum_amount || 0)) - (data.billed_amount || 0),
      };
    },
    enabled: !!id && !!vendor?.id,
  });
}

// Get single bill detail for vendor
export function useVendorBill(id: string | undefined) {
  const { data: vendor } = useCurrentVendor();
  
  return useQuery({
    queryKey: ["vendor-bill-portal", id],
    queryFn: async () => {
      if (!id || !vendor?.id) return null;
      
      const { data, error } = await supabase
        .from("vendor_bills")
        .select(`
          *,
          vendor_bill_line_items(*),
          purchase_orders(number, project_name)
        `)
        .eq("id", id)
        .eq("vendor_id", vendor.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!vendor?.id,
  });
}

// Create vendor bill from vendor portal
export function useCreateVendorBill() {
  const queryClient = useQueryClient();
  const { data: vendor } = useCurrentVendor();
  
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
      if (!vendor?.id) throw new Error("Vendor not found");
      
      const subtotal = billData.line_items.reduce((sum, item) => sum + item.total, 0);
      
      // Get vendor name for the bill
      const vendorName = vendor.name || "";
      
      // Create the bill
      const { data: bill, error: billError } = await supabase
        .from("vendor_bills")
        .insert({
          vendor_id: vendor.id,
          vendor_name: vendorName,
          purchase_order_id: billData.purchase_order_id,
          bill_date: billData.bill_date,
          due_date: billData.due_date,
          notes: billData.notes,
          subtotal,
          tax_rate: 0,
          tax_amount: 0,
          total: subtotal,
          status: "open",
          number: "", // Will be auto-generated by trigger
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
      queryClient.invalidateQueries({ queryKey: ["vendor-bills-portal"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-purchase-orders"] });
      toast.success("Bill submitted successfully");
    },
    onError: (error) => {
      toast.error("Failed to submit bill: " + error.message);
    },
  });
}

// ============ Admin hooks for vendor invitations ============

// Get invitation by token (public)
export function useVendorInvitationByToken(token: string | undefined) {
  return useQuery({
    queryKey: ["vendor-invitation-token", token],
    queryFn: async () => {
      if (!token) return null;
      
      const { data, error } = await supabase
        .from("vendor_invitations")
        .select(`
          *,
          vendor:vendors(id, name, email)
        `)
        .eq("token", token)
        .eq("status", "pending")
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data as VendorInvitation | null;
    },
    enabled: !!token,
  });
}

// Check for existing invitation for a vendor
export function useVendorInvitationCheck(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["vendor-invitation-check", vendorId],
    queryFn: async () => {
      if (!vendorId) return null;
      
      const { data, error } = await supabase
        .from("vendor_invitations")
        .select("id, status, created_at, expires_at")
        .eq("vendor_id", vendorId)
        .eq("status", "pending")
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!vendorId,
  });
}

// Send vendor portal invitation
export function useSendVendorPortalInvitation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ vendorId, email, vendorName }: { vendorId: string; email: string; vendorName: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      // Delete any existing pending invitation first
      await supabase
        .from("vendor_invitations")
        .delete()
        .eq("vendor_id", vendorId)
        .eq("status", "pending");
      
      // Create the invitation record
      const { data, error } = await supabase
        .from("vendor_invitations")
        .insert({
          vendor_id: vendorId,
          email,
          invited_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Send the invitation email via edge function
      const { error: emailError } = await supabase.functions.invoke("send-vendor-portal-invitation", {
        body: {
          vendorId,
          vendorName,
          email,
          token: data.token,
        },
      });
      
      if (emailError) {
        console.error("Failed to send invitation email:", emailError);
        throw new Error("Invitation created but failed to send email");
      }
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-invitation-check", variables.vendorId] });
      toast.success("Vendor portal invitation email sent");
    },
    onError: (error) => {
      toast.error("Failed to send invitation: " + error.message);
    },
  });
}

// Revoke vendor portal access
export function useRevokeVendorPortalAccess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (vendorId: string) => {
      const { error } = await supabase
        .from("vendors")
        .update({ user_id: null })
        .eq("id", vendorId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor portal access revoked");
    },
    onError: (error) => {
      toast.error("Failed to revoke access: " + error.message);
    },
  });
}
