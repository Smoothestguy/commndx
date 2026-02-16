import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface VendorOnboardingTokenData {
  id: string;
  vendor_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface VendorData {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  contact_name: string | null;
  contact_title: string | null;
  business_type: string | null;
  years_in_business: number | null;
  website: string | null;
  specialty: string | null;
  license_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  tax_id: string | null;
  track_1099: boolean | null;
  payment_terms: string | null;
  billing_rate: number | null;
  insurance_expiry: string | null;
  onboarding_status: string | null;
}

export interface VendorOnboardingFormData {
  // Company info
  name: string;
  company: string;
  email: string;
  phone: string;
  contact_name: string;
  contact_title: string;
  business_type: string;
  years_in_business: string;
  website: string;
  specialty: string;
  license_number: string;
  // Address
  address: string;
  city: string;
  state: string;
  zip: string;
  // Tax info
  tax_id: string;
  track_1099: boolean;
  // Banking
  bank_name: string;
  bank_account_type: string;
  bank_routing_number: string;
  bank_account_number: string;
  // W9
  w9_signature: string | null;
  // Vendor agreement
  vendor_agreement_signature: string | null;
  // Payment terms
  payment_terms: string;
  billing_rate: string;
  // Insurance
  insurance_expiry: string;
  // Work authorization
  citizenship_status: string;
  immigration_status: string;
  itin: string;
  documents: { type: string; name: string; path: string; fileType: string; fileSize: number }[];
}

export interface OnboardingValidationResult {
  isValid: boolean;
  isExpired: boolean;
  isUsed: boolean;
  token: VendorOnboardingTokenData | null;
  vendor: VendorData | null;
}

// Hook to validate onboarding token
export function useVendorOnboardingToken(token: string | undefined) {
  return useQuery({
    queryKey: ["vendor-onboarding-token", token],
    queryFn: async (): Promise<OnboardingValidationResult> => {
      if (!token) {
        return { isValid: false, isExpired: false, isUsed: false, token: null, vendor: null };
      }

      // Fetch token data
      const { data: tokenData, error: tokenError } = await supabase
        .from("vendor_onboarding_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenError) {
        console.error("Error fetching token:", tokenError);
        return { isValid: false, isExpired: false, isUsed: false, token: null, vendor: null };
      }

      if (!tokenData) {
        return { isValid: false, isExpired: false, isUsed: false, token: null, vendor: null };
      }

      // Check if expired
      const isExpired = new Date(tokenData.expires_at) < new Date();
      const isUsed = !!tokenData.used_at;

      if (isExpired || isUsed) {
        return { isValid: false, isExpired, isUsed, token: tokenData, vendor: null };
      }

      // Fetch vendor data
      const { data: vendorData, error: vendorError } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", tokenData.vendor_id)
        .single();

      if (vendorError) {
        console.error("Error fetching vendor:", vendorError);
        return { isValid: false, isExpired: false, isUsed: false, token: tokenData, vendor: null };
      }

      return {
        isValid: true,
        isExpired: false,
        isUsed: false,
        token: tokenData,
        vendor: vendorData,
      };
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to complete vendor onboarding
export function useCompleteVendorOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      token,
      vendorId,
      formData,
    }: {
      token: string;
      vendorId: string;
      formData: VendorOnboardingFormData;
    }) => {
      const { data, error } = await supabase.rpc("complete_vendor_onboarding", {
        p_token: token,
        p_vendor_id: vendorId,
        p_name: formData.name,
        p_company: formData.company || null,
        p_email: formData.email,
        p_phone: formData.phone || null,
        p_contact_name: formData.contact_name || null,
        p_contact_title: formData.contact_title || null,
        p_business_type: formData.business_type || null,
        p_years_in_business: formData.years_in_business ? parseInt(formData.years_in_business) : null,
        p_website: formData.website || null,
        p_specialty: formData.specialty || null,
        p_license_number: formData.license_number || null,
        p_address: formData.address || null,
        p_city: formData.city || null,
        p_state: formData.state || null,
        p_zip: formData.zip || null,
        p_tax_id: formData.tax_id || null,
        p_track_1099: formData.track_1099,
        p_bank_name: formData.bank_name || null,
        p_bank_account_type: formData.bank_account_type || null,
        p_bank_routing_number: formData.bank_routing_number || null,
        p_bank_account_number: formData.bank_account_number || null,
        p_w9_signature: formData.w9_signature,
        p_vendor_agreement_signature: formData.vendor_agreement_signature,
        p_payment_terms: formData.payment_terms || null,
        p_billing_rate: formData.billing_rate ? parseFloat(formData.billing_rate) : null,
        p_citizenship_status: formData.citizenship_status || null,
        p_immigration_status: formData.immigration_status || null,
        p_itin: formData.itin || null,
      });

      if (error) {
        throw error;
      }

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        throw new Error(result.error || "Failed to complete onboarding");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor onboarding completed successfully!");
    },
    onError: (error: Error) => {
      console.error("Error completing vendor onboarding:", error);
      toast.error(error.message || "Failed to complete onboarding");
    },
  });
}

// Hook to send vendor onboarding invitation via SMS
export function useSendVendorOnboardingSMS() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendorId,
      vendorName,
      phone,
    }: {
      vendorId: string;
      vendorName: string;
      phone: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-vendor-onboarding-sms", {
        body: { vendorId, vendorName, phone },
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor onboarding SMS sent successfully!");
    },
    onError: (error: Error) => {
      console.error("Error sending vendor onboarding SMS:", error);
      toast.error(error.message || "Failed to send SMS");
    },
  });
}

// Hook to send vendor onboarding invitation via email
export function useSendVendorOnboardingInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendorId,
      vendorName,
      email,
    }: {
      vendorId: string;
      vendorName: string;
      email: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-vendor-onboarding-email", {
        body: { vendorId, vendorName, email },
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor onboarding invitation sent successfully!");
    },
    onError: (error: Error) => {
      console.error("Error sending vendor onboarding invitation:", error);
      toast.error(error.message || "Failed to send invitation");
    },
  });
}
