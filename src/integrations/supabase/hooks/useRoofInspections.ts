import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RoofInspection, InspectionType, InspectionStatus, RoofCondition } from "@/types/roofing";

export function useRoofInspections() {
  return useQuery({
    queryKey: ["roof-inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roof_inspections")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name),
          inspector:personnel(first_name, last_name)
        `)
        .order("inspection_date", { ascending: false });

      if (error) throw error;
      return data as unknown as RoofInspection[];
    },
  });
}

export function useRoofInspection(id: string) {
  return useQuery({
    queryKey: ["roof-inspection", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roof_inspections")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name),
          inspector:personnel(first_name, last_name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as RoofInspection;
    },
    enabled: !!id,
  });
}

export function useCreateRoofInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inspection: {
      customer_id: string;
      project_id?: string;
      inspector_id?: string;
      inspection_date: string;
      inspection_type: InspectionType;
      status?: InspectionStatus;
      overall_condition?: RoofCondition;
      notes?: string;
      photos?: string[];
      findings?: Record<string, unknown>;
      recommendations?: string;
    }) => {
      const { data, error } = await supabase
        .from("roof_inspections")
        .insert(inspection)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roof-inspections"] });
    },
  });
}

export function useUpdateRoofInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RoofInspection> & { id: string }) => {
      const { data, error } = await supabase
        .from("roof_inspections")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roof-inspections"] });
      queryClient.invalidateQueries({ queryKey: ["roof-inspection", variables.id] });
    },
  });
}

export function useDeleteRoofInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("roof_inspections")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roof-inspections"] });
    },
  });
}
