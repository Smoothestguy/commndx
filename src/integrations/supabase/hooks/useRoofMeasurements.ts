import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RoofMeasurement, RoofType } from "@/types/roofing";
import type { Json } from "@/integrations/supabase/types";

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
        .maybeSingle();

      if (error) throw error;
      return data as unknown as RoofMeasurement | null;
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
      const insertData = {
        customer_id: measurement.customer_id,
        project_id: measurement.project_id || null,
        measurement_date: measurement.measurement_date || new Date().toISOString().split("T")[0],
        total_squares: measurement.total_squares || null,
        pitch: measurement.pitch || null,
        roof_type: measurement.roof_type || null,
        areas: (measurement.areas || []) as Json,
        ridges_length: measurement.ridges_length || null,
        valleys_length: measurement.valleys_length || null,
        eaves_length: measurement.eaves_length || null,
        penetrations: (measurement.penetrations || []) as Json,
        notes: measurement.notes || null,
      };

      const { data, error } = await supabase
        .from("roof_measurements")
        .insert(insertData)
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
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<{
      customer_id: string;
      project_id: string;
      measurement_date: string;
      total_squares: number;
      pitch: string;
      roof_type: RoofType;
      areas: { name: string; length: number; width: number; area: number }[];
      ridges_length: number;
      valleys_length: number;
      eaves_length: number;
      penetrations: { type: string; count: number }[];
      notes: string;
    }>) => {
      const updateData: Record<string, unknown> = {};
      
      if (updates.customer_id !== undefined) updateData.customer_id = updates.customer_id;
      if (updates.project_id !== undefined) updateData.project_id = updates.project_id;
      if (updates.measurement_date !== undefined) updateData.measurement_date = updates.measurement_date;
      if (updates.total_squares !== undefined) updateData.total_squares = updates.total_squares;
      if (updates.pitch !== undefined) updateData.pitch = updates.pitch;
      if (updates.roof_type !== undefined) updateData.roof_type = updates.roof_type;
      if (updates.areas !== undefined) updateData.areas = updates.areas as Json;
      if (updates.ridges_length !== undefined) updateData.ridges_length = updates.ridges_length;
      if (updates.valleys_length !== undefined) updateData.valleys_length = updates.valleys_length;
      if (updates.eaves_length !== undefined) updateData.eaves_length = updates.eaves_length;
      if (updates.penetrations !== undefined) updateData.penetrations = updates.penetrations as Json;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      const { data, error } = await supabase
        .from("roof_measurements")
        .update(updateData)
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
