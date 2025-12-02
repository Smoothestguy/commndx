import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RoofWarranty, WarrantyType, WarrantyStatus } from "@/types/roofing";

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
        .single();

      if (error) throw error;
      return data as unknown as RoofWarranty;
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
      const { data, error } = await supabase
        .from("roof_warranties")
        .insert(warranty)
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
    mutationFn: async ({ id, ...updates }: Partial<RoofWarranty> & { id: string }) => {
      const { data, error } = await supabase
        .from("roof_warranties")
        .update(updates)
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
