import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface W9Form {
  id: string;
  personnel_id: string;
  name_on_return: string;
  business_name: string | null;
  federal_tax_classification: string;
  llc_tax_classification: string | null;
  other_classification: string | null;
  has_foreign_partners: boolean;
  exempt_payee_code: string | null;
  fatca_exemption_code: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  account_numbers: string | null;
  tin_type: "ssn" | "ein";
  ein: string | null;
  signature_data: string | null;
  signature_date: string;
  certified_us_person: boolean;
  certified_correct_tin: boolean;
  certified_not_subject_backup_withholding: boolean;
  certified_fatca_exempt: boolean;
  document_url: string | null;
  status: "pending" | "completed" | "verified" | "rejected";
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  edit_allowed: boolean;
  edit_allowed_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface W9FormInput {
  personnel_id: string;
  name_on_return: string;
  business_name?: string | null;
  federal_tax_classification: string;
  llc_tax_classification?: string | null;
  other_classification?: string | null;
  has_foreign_partners?: boolean;
  exempt_payee_code?: string | null;
  fatca_exemption_code?: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  account_numbers?: string | null;
  tin_type: "ssn" | "ein";
  ein?: string | null;
  signature_data?: string | null;
  signature_date: string;
  certified_us_person?: boolean;
  certified_correct_tin?: boolean;
  certified_not_subject_backup_withholding?: boolean;
  certified_fatca_exempt?: boolean;
  document_url?: string | null;
}

// Fetch W-9 form for a specific personnel (admin use)
export const usePersonnelW9Form = (personnelId: string | undefined) => {
  return useQuery({
    queryKey: ["w9-form", personnelId],
    queryFn: async () => {
      if (!personnelId) return null;

      const { data, error } = await supabase
        .from("personnel_w9_forms")
        .select("*")
        .eq("personnel_id", personnelId)
        .maybeSingle();

      if (error) throw error;
      return data as W9Form | null;
    },
    enabled: !!personnelId,
  });
};

// Fetch current user's W-9 form (portal use)
export const useCurrentPersonnelW9Form = (personnelId: string | undefined) => {
  return useQuery({
    queryKey: ["my-w9-form", personnelId],
    queryFn: async () => {
      if (!personnelId) return null;

      const { data, error } = await supabase
        .from("personnel_w9_forms")
        .select("*")
        .eq("personnel_id", personnelId)
        .maybeSingle();

      if (error) throw error;
      return data as W9Form | null;
    },
    enabled: !!personnelId,
  });
};

// Submit or update W-9 form
export const useSubmitW9Form = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: W9FormInput) => {
      // Check if W-9 already exists
      const { data: existing } = await supabase
        .from("personnel_w9_forms")
        .select("id")
        .eq("personnel_id", formData.personnel_id)
        .maybeSingle();

      if (existing) {
        // Update existing W-9 - reset edit permissions
        const { data, error } = await supabase
          .from("personnel_w9_forms")
          .update({
            ...formData,
            status: "completed",
            edit_allowed: false,
            edit_allowed_until: null,
          })
          .eq("personnel_id", formData.personnel_id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new W-9
        const { data, error } = await supabase
          .from("personnel_w9_forms")
          .insert({
            ...formData,
            status: "completed",
            edit_allowed: false,
            edit_allowed_until: null,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["w9-form", data.personnel_id] });
      queryClient.invalidateQueries({ queryKey: ["my-w9-form", data.personnel_id] });
      toast.success("W-9 form submitted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit W-9 form: ${error.message}`);
    },
  });
};

// Verify W-9 form (admin use)
export const useVerifyW9Form = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      w9Id,
      personnelId,
      action,
      rejectionReason,
    }: {
      w9Id: string;
      personnelId: string;
      action: "verify" | "reject";
      rejectionReason?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const updateData = action === "verify"
        ? {
            status: "verified" as const,
            verified_by: user?.id,
            verified_at: new Date().toISOString(),
          }
        : {
            status: "rejected" as const,
            rejection_reason: rejectionReason,
          };

      const { data, error } = await supabase
        .from("personnel_w9_forms")
        .update(updateData)
        .eq("id", w9Id)
        .select()
        .single();

      if (error) throw error;
      return { data, personnelId };
    },
    onSuccess: ({ personnelId }) => {
      queryClient.invalidateQueries({ queryKey: ["w9-form", personnelId] });
      toast.success("W-9 form status updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update W-9 status: ${error.message}`);
    },
  });
};

// Request edit permission for W-9 form (admin use)
export const useRequestW9Edit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      w9Id,
      personnelId,
      daysValid = 7,
    }: {
      w9Id: string;
      personnelId: string;
      daysValid?: number;
    }) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + daysValid);

      const { data, error } = await supabase
        .from("personnel_w9_forms")
        .update({
          edit_allowed: true,
          edit_allowed_until: expiresAt.toISOString(),
        })
        .eq("id", w9Id)
        .select()
        .single();

      if (error) throw error;
      return { data, personnelId };
    },
    onSuccess: ({ personnelId }) => {
      queryClient.invalidateQueries({ queryKey: ["w9-form", personnelId] });
      queryClient.invalidateQueries({ queryKey: ["my-w9-form", personnelId] });
      toast.success("Edit permission granted - personnel can now modify their W-9");
    },
    onError: (error: Error) => {
      toast.error(`Failed to grant edit permission: ${error.message}`);
    },
  });
};

// Get all W-9 forms (admin overview)
export const useAllW9Forms = (status?: string) => {
  return useQuery({
    queryKey: ["all-w9-forms", status],
    queryFn: async () => {
      let query = supabase
        .from("personnel_w9_forms")
        .select(`
          *,
          personnel:personnel_id (
            id,
            first_name,
            last_name,
            email,
            personnel_number
          )
        `)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
};
