import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RoofWarranty, WarrantyType, WarrantyStatus } from "@/types/roofing";
import type { Json } from "@/integrations/supabase/types";

export function useRoofWarranties() {
  return useQuery({
    queryKey: ["roof-warranties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roof_warranties")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name)
        `)
        .order("end_date", { ascending: true });

      if (error) throw error;
      return data as unknown as RoofWarranty[];
    },
  });
}

export function useRoofWarranty(id: string) {
  return useQuery({
    queryKey: ["roof-warranty", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roof_warranties")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as RoofWarranty | null;
    },
    enabled: !!id,
  });
}

export function useCreateRoofWarranty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (warranty: {
      customer_id: string;
      project_id?: string;
      warranty_type: WarrantyType;
      provider: string;
      coverage_details?: string;
      start_date: string;
      end_date: string;
      status?: WarrantyStatus;
      warranty_number?: string;
      documents?: string[];
      notifications_enabled?: boolean;
    }) => {
      const insertData = {
        customer_id: warranty.customer_id,
        project_id: warranty.project_id || null,
        warranty_type: warranty.warranty_type,
        provider: warranty.provider,
        coverage_details: warranty.coverage_details || null,
        start_date: warranty.start_date,
        end_date: warranty.end_date,
        status: warranty.status || "active",
        warranty_number: warranty.warranty_number || null,
        documents: (warranty.documents || []) as Json,
        notifications_enabled: warranty.notifications_enabled ?? true,
      };

      const { data, error } = await supabase
        .from("roof_warranties")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roof-warranties"] });
    },
  });
}

export function useUpdateRoofWarranty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<{
      customer_id: string;
      project_id: string;
      warranty_type: WarrantyType;
      provider: string;
      coverage_details: string;
      start_date: string;
      end_date: string;
      status: WarrantyStatus;
      warranty_number: string;
      documents: string[];
      notifications_enabled: boolean;
    }>) => {
      const updateData: Record<string, unknown> = {};
      
      if (updates.customer_id !== undefined) updateData.customer_id = updates.customer_id;
      if (updates.project_id !== undefined) updateData.project_id = updates.project_id;
      if (updates.warranty_type !== undefined) updateData.warranty_type = updates.warranty_type;
      if (updates.provider !== undefined) updateData.provider = updates.provider;
      if (updates.coverage_details !== undefined) updateData.coverage_details = updates.coverage_details;
      if (updates.start_date !== undefined) updateData.start_date = updates.start_date;
      if (updates.end_date !== undefined) updateData.end_date = updates.end_date;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.warranty_number !== undefined) updateData.warranty_number = updates.warranty_number;
      if (updates.documents !== undefined) updateData.documents = updates.documents as Json;
      if (updates.notifications_enabled !== undefined) updateData.notifications_enabled = updates.notifications_enabled;

      const { data, error } = await supabase
        .from("roof_warranties")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roof-warranties"] });
      queryClient.invalidateQueries({ queryKey: ["roof-warranty", variables.id] });
    },
  });
}

export function useDeleteRoofWarranty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("roof_warranties")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roof-warranties"] });
    },
  });
}
