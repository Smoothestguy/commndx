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

interface MeasurementInput {
  customer_id: string;
  project_id?: string;
  measurement_date?: string;
  total_roof_area?: number;
  total_pitched_area?: number;
  total_flat_area?: number;
  total_facets?: number;
  total_squares?: number;
  pitch?: string;
  roof_type?: RoofType;
  eaves_length?: number;
  valleys_length?: number;
  hips_length?: number;
  ridges_length?: number;
  rakes_length?: number;
  wall_flashing_length?: number;
  step_flashing_length?: number;
  transitions_length?: number;
  parapet_wall_length?: number;
  unspecified_length?: number;
  areas?: { name: string; length: number; width: number; area: number }[];
  penetrations?: { type: string; count: number }[];
  notes?: string;
}

export function useCreateRoofMeasurement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (measurement: MeasurementInput) => {
      const insertData = {
        customer_id: measurement.customer_id,
        project_id: measurement.project_id || null,
        measurement_date: measurement.measurement_date || new Date().toISOString().split("T")[0],
        total_roof_area: measurement.total_roof_area || null,
        total_pitched_area: measurement.total_pitched_area || null,
        total_flat_area: measurement.total_flat_area || null,
        total_facets: measurement.total_facets || null,
        total_squares: measurement.total_squares || null,
        pitch: measurement.pitch || null,
        roof_type: measurement.roof_type || null,
        eaves_length: measurement.eaves_length || null,
        valleys_length: measurement.valleys_length || null,
        hips_length: measurement.hips_length || null,
        ridges_length: measurement.ridges_length || null,
        rakes_length: measurement.rakes_length || null,
        wall_flashing_length: measurement.wall_flashing_length || null,
        step_flashing_length: measurement.step_flashing_length || null,
        transitions_length: measurement.transitions_length || null,
        parapet_wall_length: measurement.parapet_wall_length || null,
        unspecified_length: measurement.unspecified_length || null,
        areas: (measurement.areas || []) as Json,
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
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<MeasurementInput>) => {
      const updateData: Record<string, unknown> = {};
      
      if (updates.customer_id !== undefined) updateData.customer_id = updates.customer_id;
      if (updates.project_id !== undefined) updateData.project_id = updates.project_id;
      if (updates.measurement_date !== undefined) updateData.measurement_date = updates.measurement_date;
      if (updates.total_roof_area !== undefined) updateData.total_roof_area = updates.total_roof_area;
      if (updates.total_pitched_area !== undefined) updateData.total_pitched_area = updates.total_pitched_area;
      if (updates.total_flat_area !== undefined) updateData.total_flat_area = updates.total_flat_area;
      if (updates.total_facets !== undefined) updateData.total_facets = updates.total_facets;
      if (updates.total_squares !== undefined) updateData.total_squares = updates.total_squares;
      if (updates.pitch !== undefined) updateData.pitch = updates.pitch;
      if (updates.roof_type !== undefined) updateData.roof_type = updates.roof_type;
      if (updates.eaves_length !== undefined) updateData.eaves_length = updates.eaves_length;
      if (updates.valleys_length !== undefined) updateData.valleys_length = updates.valleys_length;
      if (updates.hips_length !== undefined) updateData.hips_length = updates.hips_length;
      if (updates.ridges_length !== undefined) updateData.ridges_length = updates.ridges_length;
      if (updates.rakes_length !== undefined) updateData.rakes_length = updates.rakes_length;
      if (updates.wall_flashing_length !== undefined) updateData.wall_flashing_length = updates.wall_flashing_length;
      if (updates.step_flashing_length !== undefined) updateData.step_flashing_length = updates.step_flashing_length;
      if (updates.transitions_length !== undefined) updateData.transitions_length = updates.transitions_length;
      if (updates.parapet_wall_length !== undefined) updateData.parapet_wall_length = updates.parapet_wall_length;
      if (updates.unspecified_length !== undefined) updateData.unspecified_length = updates.unspecified_length;
      if (updates.areas !== undefined) updateData.areas = updates.areas as Json;
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
