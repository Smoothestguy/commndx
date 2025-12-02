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

export interface RegistrationDocument {
  name: string;
  path: string;
  type: string;
  uploaded_at: string;
}

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
  emergency_contacts: EmergencyContact[];
  documents: RegistrationDocument[];
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
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
            emergency_contacts: JSON.parse(JSON.stringify(data.emergency_contacts)),
            documents: JSON.parse(JSON.stringify(data.documents)),
            status: "pending",
          },
        ])
        .select()
        .single();

      if (error) throw error;
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

export function useApproveRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (registrationId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "approve-personnel-registration",
        {
          body: { registrationId, action: "approve" },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-registrations-count"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
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
