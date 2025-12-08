import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

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
  created_at: string;
  updated_at: string;
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

  return useMutation({
    mutationFn: async (vendor: Omit<Vendor, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("vendors")
        .insert([vendor])
        .select()
        .single();

      if (error) throw error;
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

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Vendor> & { id: string }) => {
      const { data, error } = await supabase
        .from("vendors")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
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

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendors").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor deleted successfully");
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
