import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { InsuranceClaim, ClaimStatus } from "@/types/roofing";

interface InsuranceClaimInput {
  customer_id: string;
  project_id?: string;
  claim_number?: string;
  insurance_company: string;
  policy_number?: string;
  has_adjuster?: boolean;
  adjuster_name?: string;
  adjuster_phone?: string;
  adjuster_email?: string;
  date_of_loss: string;
  damage_description?: string;
  status?: ClaimStatus;
  filed_date?: string;
  adjuster_visit_date?: string;
  approved_amount?: number;
  deductible?: number;
  documents?: string[];
  notes?: string;
}

export function useInsuranceClaims() {
  return useQuery({
    queryKey: ["insurance_claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurance_claims")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as InsuranceClaim[];
    },
  });
}

export function useInsuranceClaim(id: string) {
  return useQuery({
    queryKey: ["insurance_claims", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurance_claims")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as InsuranceClaim;
    },
    enabled: !!id,
  });
}

export function useInsuranceClaimsByCustomer(customerId: string) {
  return useQuery({
    queryKey: ["insurance_claims", "customer", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurance_claims")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name)
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as InsuranceClaim[];
    },
    enabled: !!customerId,
  });
}

export function useCreateInsuranceClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InsuranceClaimInput) => {
      const { data, error } = await supabase
        .from("insurance_claims")
        .insert({
          ...input,
          documents: input.documents || [],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurance_claims"] });
      toast.success("Insurance claim created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create insurance claim: " + error.message);
    },
  });
}

export function useUpdateInsuranceClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<InsuranceClaimInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("insurance_claims")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurance_claims"] });
      toast.success("Insurance claim updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update insurance claim: " + error.message);
    },
  });
}

export function useDeleteInsuranceClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("insurance_claims").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurance_claims"] });
      toast.success("Insurance claim deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete insurance claim: " + error.message);
    },
  });
}
