import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { 
  EmergencyContact, 
  RegistrationDocument,
  CitizenshipStatus,
  ImmigrationStatus 
} from "./usePersonnelRegistrations";

export interface OnboardingTokenData {
  id: string;
  token: string;
  personnel_id: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface PersonnelOnboardingData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  photo_url: string | null;
  applicant_id: string | null;
  onboarding_status: string | null;
  onboarding_completed_at: string | null;
}

export interface OnboardingFormData {
  // Personal info
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  photo_url?: string;
  
  // Address
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  
  // Work authorization
  ssn_full?: string;
  citizenship_status?: CitizenshipStatus;
  immigration_status?: ImmigrationStatus;
  
  // Documents and contacts
  documents: RegistrationDocument[];
  emergency_contacts: EmergencyContact[];
}

export interface OnboardingValidationResult {
  isValid: boolean;
  isExpired: boolean;
  isUsed: boolean;
  token: OnboardingTokenData | null;
  personnel: PersonnelOnboardingData | null;
  applicationAnswers: Record<string, unknown> | null;
}

/**
 * Hook to validate an onboarding token and fetch associated personnel data
 */
export function useOnboardingToken(token: string | undefined) {
  return useQuery({
    queryKey: ["onboarding-token", token],
    queryFn: async (): Promise<OnboardingValidationResult> => {
      if (!token) {
        return {
          isValid: false,
          isExpired: false,
          isUsed: false,
          token: null,
          personnel: null,
          applicationAnswers: null,
        };
      }

      // Fetch the token record
      const { data: tokenData, error: tokenError } = await supabase
        .from("personnel_onboarding_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenError) throw tokenError;

      if (!tokenData) {
        return {
          isValid: false,
          isExpired: false,
          isUsed: false,
          token: null,
          personnel: null,
          applicationAnswers: null,
        };
      }

      // Check if token is used
      const isUsed = !!tokenData.used_at;

      // Check if token is expired
      const isExpired = new Date(tokenData.expires_at) < new Date();

      if (isUsed || isExpired) {
        return {
          isValid: false,
          isExpired,
          isUsed,
          token: tokenData as OnboardingTokenData,
          personnel: null,
          applicationAnswers: null,
        };
      }

      // Fetch the personnel record
      const { data: personnelData, error: personnelError } = await supabase
        .from("personnel")
        .select("id, first_name, last_name, email, phone, date_of_birth, address, city, state, zip, photo_url, applicant_id, onboarding_status, onboarding_completed_at")
        .eq("id", tokenData.personnel_id)
        .maybeSingle();

      if (personnelError) throw personnelError;

      // If personnel has applicant_id, try to fetch application answers
      let applicationAnswers: Record<string, unknown> | null = null;
      if (personnelData?.applicant_id) {
        const { data: applicationData } = await supabase
          .from("applications")
          .select("answers")
          .eq("applicant_id", personnelData.applicant_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (applicationData?.answers) {
          applicationAnswers = applicationData.answers as Record<string, unknown>;
        }
      }

      return {
        isValid: true,
        isExpired: false,
        isUsed: false,
        token: tokenData as OnboardingTokenData,
        personnel: personnelData as PersonnelOnboardingData,
        applicationAnswers,
      };
    },
    enabled: !!token,
    staleTime: 30000, // Cache for 30 seconds
  });
}

/**
 * Hook to complete onboarding - updates personnel record and marks token as used
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      token,
      personnelId,
      formData,
    }: {
      token: string;
      personnelId: string;
      formData: OnboardingFormData;
    }) => {
      console.log("[Onboarding] Starting onboarding completion for personnel:", personnelId);

      // 1. Update personnel record with all the new data
      const { error: personnelError } = await supabase
        .from("personnel")
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone || null,
          date_of_birth: formData.date_of_birth || null,
          photo_url: formData.photo_url || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          zip: formData.zip || null,
          ssn_full: formData.ssn_full || null,
          ssn_last_four: formData.ssn_full ? formData.ssn_full.slice(-4) : null,
          citizenship_status: formData.citizenship_status || null,
          immigration_status: formData.immigration_status || null,
          onboarding_status: "completed",
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", personnelId);

      if (personnelError) {
        console.error("[Onboarding] Error updating personnel:", personnelError);
        throw personnelError;
      }

      console.log("[Onboarding] Personnel record updated successfully");

      // 2. Save emergency contacts
      if (formData.emergency_contacts.length > 0) {
        // First delete existing contacts
        await supabase
          .from("emergency_contacts")
          .delete()
          .eq("personnel_id", personnelId);

        // Then insert new contacts
        const contactsToInsert = formData.emergency_contacts.map((contact) => ({
          personnel_id: personnelId,
          contact_name: contact.name,
          relationship: contact.relationship,
          phone: contact.phone,
          email: contact.email || null,
          is_primary: contact.is_primary,
        }));

        const { error: contactsError } = await supabase
          .from("emergency_contacts")
          .insert(contactsToInsert);

        if (contactsError) {
          console.error("[Onboarding] Error saving emergency contacts:", contactsError);
          throw contactsError;
        }

        console.log("[Onboarding] Emergency contacts saved successfully");
      }

      // 3. Documents are already uploaded to storage via the form
      // The file paths are stored in the documents array but we don't have a personnel_documents table
      // If needed in the future, we can create that table and save them here
      console.log("[Onboarding] Documents uploaded:", formData.documents.length);

      // 4. Mark token as used
      const { error: tokenError } = await supabase
        .from("personnel_onboarding_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("token", token);

      if (tokenError) {
        console.error("[Onboarding] Error marking token as used:", tokenError);
        throw tokenError;
      }

      console.log("[Onboarding] Token marked as used");

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-token", variables.token] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      toast.success("Onboarding completed successfully!");
    },
    onError: (error: Error) => {
      console.error("[Onboarding] Completion failed:", error);
      toast.error(`Failed to complete onboarding: ${error.message}`);
    },
  });
}
