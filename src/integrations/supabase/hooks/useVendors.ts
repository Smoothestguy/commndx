import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";
import { useAuditLog, computeChanges } from "@/hooks/useAuditLog";
import type { Json } from "@/integrations/supabase/types";

export type VendorType = "contractor" | "personnel" | "supplier";

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  specialty: string | null;
  status: "active" | "inactive";
  vendor_type: VendorType;
  rating: number | null;
  insurance_expiry: string | null;
  license_number: string | null;
  w9_on_file: boolean;
  // Address fields
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  // Tax and 1099 fields
  tax_id: string | null;
  track_1099: boolean;
  // Billing and payment fields
  billing_rate: number | null;
  payment_terms: string | null;
  account_number: string | null;
  // Accounting fields
  default_expense_category_id: string | null;
  opening_balance: number | null;
  // Notes
  notes: string | null;
  // Portal access
  user_id: string | null;
  onboarding_status: string | null;
  onboarding_completed_at: string | null;
  // Banking
  bank_name: string | null;
  bank_account_type: string | null;
  bank_routing_number: string | null;
  bank_account_number: string | null;
  // Signatures
  w9_signature: string | null;
  w9_signed_at: string | null;
  vendor_agreement_signature: string | null;
  vendor_agreement_signed_at: string | null;
  // Work authorization
  citizenship_status: string | null;
  immigration_status: string | null;
  itin: string | null;
  // Additional fields
  business_type: string | null;
  contact_name: string | null;
  contact_title: string | null;
  years_in_business: number | null;
  website: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to check if QuickBooks is connected
async function isQuickBooksConnected(): Promise<boolean> {
  const { data } = await supabase
    .from("quickbooks_config")
    .select("is_connected")
    .single();
  return data?.is_connected === true;
}

export const useVendors = () => {
  return useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Vendor[];
    },
  });
};

export const useAddVendor = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (vendor: Omit<Vendor, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("vendors")
        .insert([vendor])
        .select()
        .single();

      if (error) throw error;

      // Auto-sync to QuickBooks if connected
      try {
        const qbConnected = await isQuickBooksConnected();
        if (qbConnected) {
          console.log("QuickBooks connected - syncing vendor:", data.id);
          await supabase.functions.invoke("quickbooks-sync-vendors", {
            body: { action: "sync-single", vendorId: data.id },
          });
        }
      } catch (qbError) {
        console.error("QuickBooks sync error (non-blocking):", qbError);
        // Don't throw - QB sync failure shouldn't prevent vendor creation
      }

      // Log audit action
      await logAction({
        actionType: "create",
        resourceType: "vendor",
        resourceId: data.id,
        resourceNumber: data.name,
        changesAfter: data as unknown as Json,
        metadata: { 
          vendor_type: vendor.vendor_type,
          email: vendor.email 
        } as Json,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add vendor: ${error.message}`);
    },
  });
};

export const useUpdateVendor = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Vendor> & { id: string }) => {
      // Fetch original for audit
      const { data: originalData } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", id)
        .single();

      const { data, error } = await supabase
        .from("vendors")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Auto-sync to QuickBooks if connected
      try {
        const qbConnected = await isQuickBooksConnected();
        if (qbConnected) {
          console.log("QuickBooks connected - syncing updated vendor:", id);
          const { data: syncResult, error: syncError } = await supabase.functions.invoke(
            "quickbooks-update-vendor",
            { body: { vendorId: id } }
          );
          
          if (syncError || syncResult?.error) {
            console.error("QuickBooks sync error:", syncError || syncResult?.error);
            // Surface error to user (non-blocking) - will show in onSuccess
            toast.warning("Vendor saved, but QuickBooks sync failed. Check sync status.");
          }
        }
      } catch (qbError) {
        console.error("QuickBooks sync error (non-blocking):", qbError);
        toast.warning("Vendor saved, but QuickBooks sync failed.");
      }

      // Log audit action
      const { changesBefore, changesAfter } = computeChanges(
        originalData as Record<string, unknown>,
        data as Record<string, unknown>
      );
      await logAction({
        actionType: "update",
        resourceType: "vendor",
        resourceId: id,
        resourceNumber: data.name,
        changesBefore,
        changesAfter,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update vendor: ${error.message}`);
    },
  });
};

export const useDeleteVendor = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch original for audit
      const { data: originalData } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", id)
        .single();

      const { data: { user } } = await supabase.auth.getUser();
      
      // Soft delete instead of hard delete
      const { error } = await supabase
        .from("vendors")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .eq("id", id);

      if (error) throw error;

      // Log audit action
      await logAction({
        actionType: "delete",
        resourceType: "vendor",
        resourceId: id,
        resourceNumber: originalData?.name,
        changesBefore: originalData as unknown as Json,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["deleted_items"] });
      toast.success("Vendor moved to trash");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete vendor: ${error.message}`);
    },
  });
};

export const useBatchDeleteVendors = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("vendors")
        .delete()
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success(`${ids.length} vendor(s) deleted successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete vendors: ${error.message}`);
    },
  });
};

export const useBatchUpdateVendorType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, vendor_type }: { ids: string[]; vendor_type: VendorType }) => {
      const { error } = await supabase
        .from("vendors")
        .update({ vendor_type })
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: (_, { ids, vendor_type }) => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success(`${ids.length} vendor(s) updated to ${vendor_type}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update vendor types: ${error.message}`);
    },
  });
};
