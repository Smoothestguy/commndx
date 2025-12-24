import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  is_primary: boolean;
}

export type DocumentType = 
  | 'ssn_card' 
  | 'government_id' 
  | 'visa' 
  | 'work_permit' 
  | 'green_card_front' 
  | 'green_card_back' 
  | 'other';

export interface RegistrationDocument {
  name: string;
  path: string;
  type: string;
  uploaded_at: string;
  document_type?: DocumentType;
  label?: string;
}

export type CitizenshipStatus = 'us_citizen' | 'non_us_citizen';
export type ImmigrationStatus = 'visa' | 'work_permit' | 'green_card' | 'other';

export interface PersonnelRegistration {
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
  work_authorization_type: string | null;
  work_auth_expiry: string | null;
  ssn_last_four: string | null;
  ssn_full: string | null;
  citizenship_status: CitizenshipStatus | null;
  immigration_status: ImmigrationStatus | null;
  emergency_contacts: EmergencyContact[];
  documents: RegistrationDocument[];
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  personnel_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrationFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  work_authorization_type?: string;
  work_auth_expiry?: string;
  ssn_last_four?: string;
  ssn_full?: string;
  citizenship_status?: CitizenshipStatus;
  immigration_status?: ImmigrationStatus;
  emergency_contacts: EmergencyContact[];
  documents: RegistrationDocument[];
}

export function usePersonnelRegistrations(status?: string) {
  return useQuery({
    queryKey: ["personnel-registrations", status],
    queryFn: async () => {
      let query = supabase
        .from("personnel_registrations")
        .select("*")
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as PersonnelRegistration[];
    },
  });
}

export function usePendingRegistrationsCount() {
  return useQuery({
    queryKey: ["personnel-registrations-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("personnel_registrations")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      if (error) throw error;
      return count || 0;
    },
  });
}

export function useSubmitRegistration() {
  return useMutation({
    mutationFn: async (data: RegistrationFormData) => {
      const { data: result, error } = await supabase
        .from("personnel_registrations")
        .insert([
          {
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            phone: data.phone || null,
            date_of_birth: data.date_of_birth || null,
            address: data.address || null,
            city: data.city || null,
            state: data.state || null,
            zip: data.zip || null,
            work_authorization_type: data.work_authorization_type || null,
            work_auth_expiry: data.work_auth_expiry || null,
            ssn_last_four: data.ssn_last_four || null,
            ssn_full: data.ssn_full || null,
            citizenship_status: data.citizenship_status || null,
            immigration_status: data.immigration_status || null,
            emergency_contacts: JSON.parse(JSON.stringify(data.emergency_contacts)),
            documents: JSON.parse(JSON.stringify(data.documents)),
            status: "pending",
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Notify admins about the new application
      try {
        await supabase.functions.invoke("create-admin-notification", {
          body: {
            notification_type: "new_application",
            title: `New Application: ${data.first_name} ${data.last_name}`,
            message: `A new personnel application has been submitted by ${data.first_name} ${data.last_name} (${data.email}).`,
            link_url: "/staffing/applications",
            related_id: result.id,
            metadata: {
              applicant_name: `${data.first_name} ${data.last_name}`,
              applicant_email: data.email,
              applicant_phone: data.phone || null,
            },
          },
        });
        console.log("[Registration] Admin notification sent for new application");
      } catch (notifError) {
        console.error("[Registration] Failed to send admin notification:", notifError);
        // Non-fatal, don't throw
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Registration submitted successfully!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit registration: ${error.message}`);
    },
  });
}

export type RecordType = 'personnel' | 'vendor' | 'customer' | 'personnel_vendor';

export function useApproveRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      registrationId, 
      recordType = 'personnel' 
    }: { 
      registrationId: string; 
      recordType?: RecordType;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "approve-personnel-registration",
        {
          body: { registrationId, action: "approve", recordType },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-registrations-count"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Registration approved successfully!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve registration: ${error.message}`);
    },
  });
}

export function useRejectRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      registrationId,
      reason,
    }: {
      registrationId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "approve-personnel-registration",
        {
          body: { registrationId, action: "reject", reason },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-registrations-count"] });
      toast.success("Registration rejected");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject registration: ${error.message}`);
    },
  });
}

export function useUploadRegistrationDocument() {
  return useMutation({
    mutationFn: async ({
      file,
      registrationId,
    }: {
      file: File;
      registrationId: string;
    }) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${registrationId}/${Date.now()}.${fileExt}`;
      const filePath = `pending/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("personnel-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      return {
        name: file.name,
        path: filePath,
        type: file.type,
        uploaded_at: new Date().toISOString(),
      } as RegistrationDocument;
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload document: ${error.message}`);
    },
  });
}
