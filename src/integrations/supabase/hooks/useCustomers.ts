import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  address: string | null;
  jobsite_address: string | null;
  tax_exempt: boolean;
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

export const useCustomers = () => {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Customer[];
    },
  });
};

export const useAddCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customer: Omit<Customer, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("customers")
        .insert([customer])
        .select()
        .single();

      if (error) throw error;

      // Auto-sync to QuickBooks if connected
      try {
        const qbConnected = await isQuickBooksConnected();
        if (qbConnected) {
          console.log("QuickBooks connected - syncing customer:", data.id);
          await supabase.functions.invoke("quickbooks-sync-customers", {
            body: { action: "sync-single", customerId: data.id },
          });
        }
      } catch (qbError) {
        console.error("QuickBooks sync error (non-blocking):", qbError);
        // Don't throw - QB sync failure shouldn't prevent customer creation
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add customer: ${error.message}`);
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Customer> & { id: string }) => {
      const { data, error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Auto-sync to QuickBooks if connected
      try {
        const qbConnected = await isQuickBooksConnected();
        if (qbConnected) {
          console.log("QuickBooks connected - syncing updated customer:", id);
          await supabase.functions.invoke("quickbooks-sync-customers", {
            body: { action: "sync-single", customerId: id },
          });
        }
      } catch (qbError) {
        console.error("QuickBooks sync error (non-blocking):", qbError);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update customer: ${error.message}`);
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete customer: ${error.message}`);
    },
  });
};
