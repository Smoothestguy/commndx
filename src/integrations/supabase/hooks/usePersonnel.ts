import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];
type PersonnelInsert = Database["public"]["Tables"]["personnel"]["Insert"];
type PersonnelUpdate = Database["public"]["Tables"]["personnel"]["Update"];

export const usePersonnel = (filters?: {
  status?: string;
  search?: string;
  everifyStatus?: string;
  vendorId?: string;
}) => {
  return useQuery({
    queryKey: ["personnel", filters],
    queryFn: async () => {
      let query = supabase
        .from("personnel")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status as any);
      }

      if (filters?.search) {
        query = query.or(
          `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,personnel_number.ilike.%${filters.search}%`
        );
      }

      if (filters?.everifyStatus && filters.everifyStatus !== "all") {
        query = query.eq("everify_status", filters.everifyStatus as any);
      }

      if (filters?.vendorId && filters.vendorId !== "all") {
        query = query.eq("vendor_id", filters.vendorId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Personnel[];
    },
  });
};

export const usePersonnelByVendor = (vendorId: string | undefined) => {
  return useQuery({
    queryKey: ["personnel-by-vendor", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];

      const { data, error } = await supabase
        .from("personnel")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("first_name", { ascending: true });

      if (error) throw error;
      return data as Personnel[];
    },
    enabled: !!vendorId,
  });
};

export const useAssignPersonnelToVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      personnelId,
      vendorId,
    }: {
      personnelId: string;
      vendorId: string | null;
    }) => {
      const { data, error } = await supabase
        .from("personnel")
        .update({ vendor_id: vendorId })
        .eq("id", personnelId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-by-vendor"] });
      queryClient.invalidateQueries({ queryKey: ["personnel", variables.personnelId] });
      toast.success(
        variables.vendorId
          ? "Personnel assigned to vendor"
          : "Personnel removed from vendor"
      );
    },
    onError: (error: Error) => {
      toast.error(`Failed to update personnel: ${error.message}`);
    },
  });
};

export const usePersonnelWithRelations = (filters?: {
  status?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: ["personnel-with-relations", filters],
    queryFn: async () => {
      let query = supabase
        .from("personnel")
        .select(`
          *,
          certifications:personnel_certifications(*),
          languages:personnel_languages(*),
          capabilities:personnel_capabilities(*)
        `)
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status as any);
      }

      if (filters?.search) {
        query = query.or(
          `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,personnel_number.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
};

export const usePersonnelById = (id: string | undefined) => {
  return useQuery({
    queryKey: ["personnel", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("personnel")
        .select(
          `
          *,
          certifications:personnel_certifications(*),
          languages:personnel_languages(*),
          capabilities:personnel_capabilities(*),
          emergency_contacts(*)
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useAddPersonnel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (personnel: PersonnelInsert) => {
      const { data, error } = await supabase
        .from("personnel")
        .insert(personnel)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      toast.success("Personnel added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add personnel: ${error.message}`);
    },
  });
};

export const useBulkAddPersonnel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (personnelList: PersonnelInsert[]) => {
      const { data, error } = await supabase
        .from("personnel")
        .insert(personnelList)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-stats"] });
      toast.success(`Successfully imported ${data.length} personnel record(s)`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to import personnel: ${error.message}`);
    },
  });
};

export const useUpdatePersonnel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: PersonnelUpdate;
    }) => {
      const { data, error } = await supabase
        .from("personnel")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["personnel", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-by-project"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-by-vendor"] });
      toast.success("Personnel updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update personnel: ${error.message}`);
    },
  });
};

export const useUpdatePersonnelRating = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      rating,
    }: {
      id: string;
      rating: number;
    }) => {
      const { data, error } = await supabase
        .from("personnel")
        .update({ rating })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["personnel", variables.id] });
      toast.success("Rating updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update rating: ${error.message}`);
    },
  });
};

export const useDeletePersonnel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("personnel")
        .update({ status: "inactive" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-by-project"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-by-vendor"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-stats"] });
      toast.success("Personnel deactivated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to deactivate personnel: ${error.message}`);
    },
  });
};

export const useToggleDoNotHire = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      currentStatus,
    }: {
      id: string;
      currentStatus: string;
    }) => {
      const newStatus =
        currentStatus === "do_not_hire" ? "inactive" : "do_not_hire";

      const { error } = await supabase
        .from("personnel")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["personnel", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-by-project"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-by-vendor"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-stats"] });
      toast.success(
        newStatus === "do_not_hire"
          ? "Marked as Do Not Hire"
          : "Removed Do Not Hire flag"
      );
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });
};

export const usePersonnelStats = () => {
  return useQuery({
    queryKey: ["personnel-stats"],
    queryFn: async () => {
      const { data: all } = await supabase.from("personnel").select("*");

      const { data: active } = await supabase
        .from("personnel")
        .select("*")
        .eq("status", "active");

      const { data: inactive } = await supabase
        .from("personnel")
        .select("*")
        .eq("status", "inactive");

      const { data: doNotHire } = await supabase
        .from("personnel")
        .select("*")
        .eq("status", "do_not_hire");

      const { data: expiring } = await supabase
        .from("personnel_certifications")
        .select("*")
        .gte("expiry_date", new Date().toISOString())
        .lte(
          "expiry_date",
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        );

      return {
        total: all?.length || 0,
        active: active?.length || 0,
        inactive: inactive?.length || 0,
        doNotHire: doNotHire?.length || 0,
        expiringCerts: expiring?.length || 0,
      };
    },
  });
};

export const useResendOnboardingEmail = () => {
  return useMutation({
    mutationFn: async ({
      personnelId,
      email,
      firstName,
      lastName,
    }: {
      personnelId: string;
      email: string;
      firstName: string;
      lastName: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "send-personnel-onboarding-email",
        {
          body: { personnelId, email, firstName, lastName },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Onboarding email sent successfully!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });
};

export const useHardDeletePersonnel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete related records first
      await supabase.from("emergency_contacts").delete().eq("personnel_id", id);
      await supabase.from("personnel_certifications").delete().eq("personnel_id", id);
      await supabase.from("personnel_languages").delete().eq("personnel_id", id);
      await supabase.from("personnel_capabilities").delete().eq("personnel_id", id);
      await supabase.from("personnel_onboarding_tokens").delete().eq("personnel_id", id);
      
      // Clear the link in personnel_registrations
      await supabase
        .from("personnel_registrations")
        .update({ personnel_id: null })
        .eq("personnel_id", id);

      // Finally delete personnel
      const { error } = await supabase.from("personnel").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-stats"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-registrations"] });
      toast.success("Personnel permanently deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });
};
