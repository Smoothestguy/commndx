import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type PersonnelCertification =
  Database["public"]["Tables"]["personnel_certifications"]["Row"];
type PersonnelCertificationInsert =
  Database["public"]["Tables"]["personnel_certifications"]["Insert"];
type PersonnelCertificationUpdate =
  Database["public"]["Tables"]["personnel_certifications"]["Update"];

export const usePersonnelCertifications = (personnelId: string | undefined) => {
  return useQuery({
    queryKey: ["personnel-certifications", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];

      const { data, error } = await supabase
        .from("personnel_certifications")
        .select("*")
        .eq("personnel_id", personnelId)
        .order("expiry_date", { ascending: true });

      if (error) throw error;
      return data as PersonnelCertification[];
    },
    enabled: !!personnelId,
  });
};

export const useAddCertification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (certification: PersonnelCertificationInsert) => {
      const { data, error } = await supabase
        .from("personnel_certifications")
        .insert(certification)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["personnel-certifications", data.personnel_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["personnel", data.personnel_id],
      });
      toast.success("Certification added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add certification: ${error.message}`);
    },
  });
};

export const useUpdateCertification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: PersonnelCertificationUpdate;
    }) => {
      const { data, error } = await supabase
        .from("personnel_certifications")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["personnel-certifications", data.personnel_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["personnel", data.personnel_id],
      });
      toast.success("Certification updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update certification: ${error.message}`);
    },
  });
};

export const useDeleteCertification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, personnelId }: { id: string; personnelId: string }) => {
      const { error } = await supabase
        .from("personnel_certifications")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return personnelId;
    },
    onSuccess: (personnelId) => {
      queryClient.invalidateQueries({
        queryKey: ["personnel-certifications", personnelId],
      });
      queryClient.invalidateQueries({ queryKey: ["personnel", personnelId] });
      toast.success("Certification deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete certification: ${error.message}`);
    },
  });
};

export const useExpiringCertifications = () => {
  return useQuery({
    queryKey: ["expiring-certifications"],
    queryFn: async () => {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from("personnel_certifications")
        .select(
          `
          *,
          personnel:personnel_id (
            first_name,
            last_name,
            personnel_number
          )
        `
        )
        .gte("expiry_date", new Date().toISOString())
        .lte("expiry_date", thirtyDaysFromNow.toISOString())
        .order("expiry_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
};
