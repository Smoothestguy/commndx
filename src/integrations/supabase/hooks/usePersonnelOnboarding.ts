import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { 
  EmergencyContact, 
  RegistrationDocument,
  CitizenshipStatus,
  ImmigrationStatus 
} from "./usePersonnelRegistrations";

// ==================== TYPES ====================

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
      // Also notify admins that someone started onboarding (fire and forget)
      try {
        const { data: personnelPreview } = await supabase
          .from("personnel")
          .select("first_name, last_name, email")
          .eq("id", tokenData.personnel_id)
          .maybeSingle();

        if (personnelPreview) {
          // Check if we've already notified for this token to avoid duplicates
          const notifiedKey = `onboarding_started_${token}`;
          if (!sessionStorage.getItem(notifiedKey)) {
            sessionStorage.setItem(notifiedKey, "true");
            
            supabase.functions.invoke("create-admin-notification", {
              body: {
                notification_type: "onboarding_started",
                title: `Onboarding Started: ${personnelPreview.first_name} ${personnelPreview.last_name}`,
                message: `${personnelPreview.first_name} ${personnelPreview.last_name} has opened their onboarding link and started the process.`,
                link_url: `/personnel/${tokenData.personnel_id}`,
                related_id: tokenData.personnel_id,
                metadata: {
                  personnel_name: `${personnelPreview.first_name} ${personnelPreview.last_name}`,
                  personnel_email: personnelPreview.email,
                },
              },
            }).catch((err) => {
              console.error("[Onboarding] Failed to send started notification:", err);
            });
          }
        }
      } catch (notifError) {
        console.error("[Onboarding] Error sending started notification:", notifError);
      }
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
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (user is filling out form)
    refetchOnWindowFocus: false, // Don't refetch when user switches back to tab (common on mobile)
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
      bankName,
      bankAccountType,
      bankRoutingNumber,
      bankAccountNumber,
      directDepositSignature,
      taxClassification,
      taxEin,
      taxBusinessName,
      w9Signature,
      w9Certification,
      icaSignature,
    }: {
      token: string;
      personnelId: string;
      formData: OnboardingFormData;
      bankName?: string;
      bankAccountType?: string;
      bankRoutingNumber?: string;
      bankAccountNumber?: string;
      directDepositSignature?: string | null;
      taxClassification?: string;
      taxEin?: string;
      taxBusinessName?: string;
      w9Signature?: string | null;
      w9Certification?: boolean;
      icaSignature?: string | null;
    }) => {
      console.log("[Onboarding] Starting onboarding completion for personnel:", personnelId);

      // Prepare documents array for the RPC function
      // Map the document fields correctly - CategoryDocumentUpload uses 'type' for MIME type
      const documentsPayload = formData.documents.map(doc => ({
        type: doc.document_type,
        name: doc.name,
        path: doc.path,
        fileType: (doc as { type?: string }).type || null, // The MIME type is stored in 'type' from upload
        fileSize: (doc as { fileSize?: number }).fileSize || 0,
      }));

      // Use the security definer function to complete onboarding
      // This bypasses RLS policies after validating the token
      const { data, error } = await supabase.rpc("complete_personnel_onboarding", {
        p_token: token,
        p_personnel_id: personnelId,
        p_first_name: formData.first_name,
        p_last_name: formData.last_name,
        p_email: formData.email,
        p_phone: formData.phone || null,
        p_date_of_birth: formData.date_of_birth || null,
        p_photo_url: formData.photo_url || null,
        p_address: formData.address || null,
        p_city: formData.city || null,
        p_state: formData.state || null,
        p_zip: formData.zip || null,
        p_ssn_full: formData.ssn_full || null,
        p_citizenship_status: formData.citizenship_status || null,
        p_immigration_status: formData.immigration_status || null,
        p_emergency_contacts: JSON.parse(JSON.stringify(formData.emergency_contacts)),
        p_bank_name: bankName || null,
        p_bank_account_type: bankAccountType || null,
        p_bank_routing_number: bankRoutingNumber || null,
        p_bank_account_number: bankAccountNumber || null,
        p_direct_deposit_signature: directDepositSignature || null,
        p_tax_classification: taxClassification || null,
        p_tax_ein: taxEin || null,
        p_tax_business_name: taxBusinessName || null,
        p_w9_signature: w9Signature || null,
        p_w9_certification: w9Certification || false,
        p_ica_signature: icaSignature || null,
        p_documents: JSON.parse(JSON.stringify(documentsPayload)),
      });

      if (error) {
        console.error("[Onboarding] RPC error:", error);
        throw error;
      }

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        console.error("[Onboarding] Function returned error:", result.error);
        throw new Error(result.error || "Failed to complete onboarding");
      }

      console.log("[Onboarding] Completed successfully:", result.message);
      console.log("[Onboarding] Documents saved:", formData.documents.length);

      // Send confirmation email (fire and forget - don't block on this)
      try {
        const personnelName = `${formData.first_name} ${formData.last_name}`;
        console.log("[Onboarding] Sending confirmation email to:", formData.email);
        
        await supabase.functions.invoke("send-onboarding-confirmation-email", {
          body: {
            personnelId,
            personnelEmail: formData.email,
            personnelName,
          },
        });
        console.log("[Onboarding] Confirmation email sent successfully");
      } catch (emailError) {
        // Don't fail the whole operation if email fails
        console.error("[Onboarding] Failed to send confirmation email:", emailError);
      }

      // Notify admins about completed onboarding
      try {
        await supabase.functions.invoke("create-admin-notification", {
          body: {
            notification_type: "onboarding_complete",
            title: `Onboarding Complete: ${formData.first_name} ${formData.last_name}`,
            message: `${formData.first_name} ${formData.last_name} has completed all onboarding documentation.`,
            link_url: `/personnel/${personnelId}`,
            related_id: personnelId,
            metadata: {
              personnel_name: `${formData.first_name} ${formData.last_name}`,
              personnel_email: formData.email,
            },
          },
        });
        console.log("[Onboarding] Admin notification sent for completed onboarding");
      } catch (notifError) {
        console.error("[Onboarding] Failed to send completion notification:", notifError);
      }

      // Trigger auto-sync to QuickBooks if enabled
      try {
        // Check if auto-sync is enabled
        const { data: autoSyncSetting } = await supabase
          .from("integration_settings")
          .select("setting_value")
          .eq("setting_key", "auto_sync_personnel_to_qb")
          .maybeSingle();

        const isAutoSyncEnabled = (autoSyncSetting?.setting_value as { enabled?: boolean })?.enabled;

        if (isAutoSyncEnabled) {
          console.log("[Onboarding] Auto-sync to QuickBooks enabled, triggering sync");
          supabase.functions.invoke("sync-personnel-to-quickbooks", {
            body: { personnel_id: personnelId },
          }).then((result) => {
            if (result.error) {
              console.error("[Onboarding] Auto-sync to QuickBooks failed:", result.error);
            } else {
              console.log("[Onboarding] Auto-sync to QuickBooks completed:", result.data);
            }
          }).catch((syncError) => {
            console.error("[Onboarding] Auto-sync to QuickBooks error:", syncError);
          });
        }
      } catch (autoSyncError) {
        console.error("[Onboarding] Error checking auto-sync setting:", autoSyncError);
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-token", variables.token] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-documents", variables.personnelId] });
      toast.success("Onboarding completed successfully!");
    },
    onError: (error: Error) => {
      console.error("[Onboarding] Completion failed:", error);
      toast.error(`Failed to complete onboarding: ${error.message}`);
    },
  });
}

// ==================== REVOKE ONBOARDING TOKEN ====================

/**
 * Hook to revoke an active onboarding token
 */
export function useRevokeOnboardingToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      personnelId,
      reason,
    }: {
      personnelId: string;
      reason?: string;
    }) => {
      console.log("[Onboarding] Revoking token for personnel:", personnelId);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Find active tokens for this personnel
      const { data: tokens, error: fetchError } = await supabase
        .from("personnel_onboarding_tokens")
        .select("id")
        .eq("personnel_id", personnelId)
        .is("used_at", null)
        .is("revoked_at", null);

      if (fetchError) throw fetchError;

      if (!tokens || tokens.length === 0) {
        throw new Error("No active onboarding tokens found");
      }

      // Revoke all active tokens
      const { error: revokeError } = await supabase
        .from("personnel_onboarding_tokens")
        .update({
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
          revoke_reason: reason || null,
        })
        .eq("personnel_id", personnelId)
        .is("used_at", null)
        .is("revoked_at", null);

      if (revokeError) throw revokeError;

      // Update personnel onboarding status
      const { error: personnelError } = await supabase
        .from("personnel")
        .update({
          onboarding_status: "revoked",
          updated_at: new Date().toISOString(),
        })
        .eq("id", personnelId);

      if (personnelError) throw personnelError;

      return { success: true, revokedCount: tokens.length };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel", variables.personnelId] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      toast.success("Onboarding link revoked successfully");
    },
    onError: (error: Error) => {
      console.error("[Onboarding] Revoke failed:", error);
      toast.error(`Failed to revoke onboarding link: ${error.message}`);
    },
  });
}

// ==================== REVERSE REGISTRATION APPROVAL ====================

/**
 * Hook to reverse a registration approval
 */
export function useReverseRegistrationApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      registrationId,
      reason,
    }: {
      registrationId: string;
      reason?: string;
    }) => {
      console.log("[Registration] Reversing approval:", registrationId);

      const { data, error } = await supabase.functions.invoke(
        "reverse-personnel-approval",
        {
          body: { registrationId, reason },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["pending-registrations-count"] });
      toast.success("Registration approval reversed successfully");
    },
    onError: (error: Error) => {
      console.error("[Registration] Reverse failed:", error);
      toast.error(`Failed to reverse approval: ${error.message}`);
    },
  });
}
