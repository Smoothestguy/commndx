import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RoofMeasurement, RoofType } from "@/types/roofing";

export function useRoofMeasurements() {
  return useQuery({
    queryKey: ["roof-measurements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roof_measurements")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name)
        `)
        .order("measurement_date", { ascending: false });

      if (error) throw error;
      return data as unknown as RoofMeasurement[];
    },
  });
}

export function useRoofMeasurement(id: string) {
  return useQuery({
    queryKey: ["roof-measurement", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roof_measurements")
        .select(`
          *,
          customer:customers(name, company),
          project:projects(name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as RoofMeasurement;
    },
    enabled: !!id,
  });
}

export function useCreateRoofMeasurement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (measurement: {
      customer_id: string;
      project_id?: string;
      measurement_date?: string;
      total_squares?: number;
      pitch?: string;
      roof_type?: RoofType;
      areas?: { name: string; length: number; width: number; area: number }[];
      ridges_length?: number;
      valleys_length?: number;
      eaves_length?: number;
      penetrations?: { type: string; count: number }[];
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("roof_measurements")
        .insert(measurement)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roof-measurements"] });
    },
  });
}

export function useUpdateRoofMeasurement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RoofMeasurement> & { id: string }) => {
      const { data, error } = await supabase
        .from("roof_measurements")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roof-measurements"] });
      queryClient.invalidateQueries({ queryKey: ["roof-measurement", variables.id] });
    },
  });
}

export function useDeleteRoofMeasurement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("roof_measurements")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roof-measurements"] });
    },
  });
}
