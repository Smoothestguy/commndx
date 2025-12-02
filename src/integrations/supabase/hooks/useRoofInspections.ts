import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RoofInspection, InspectionType, InspectionStatus, RoofCondition } from "@/types/roofing";
import type { Json } from "@/integrations/supabase/types";

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
        .maybeSingle();

      if (error) throw error;
      return data as unknown as RoofInspection | null;
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
      const insertData = {
        customer_id: inspection.customer_id,
        project_id: inspection.project_id || null,
        inspector_id: inspection.inspector_id || null,
        inspection_date: inspection.inspection_date,
        inspection_type: inspection.inspection_type,
        status: inspection.status || "scheduled",
        overall_condition: inspection.overall_condition || null,
        notes: inspection.notes || null,
        photos: (inspection.photos || []) as Json,
        findings: (inspection.findings || {}) as Json,
        recommendations: inspection.recommendations || null,
      };

      const { data, error } = await supabase
        .from("roof_inspections")
        .insert(insertData)
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
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<{
      customer_id: string;
      project_id: string;
      inspector_id: string;
      inspection_date: string;
      inspection_type: InspectionType;
      status: InspectionStatus;
      overall_condition: RoofCondition;
      notes: string;
      photos: string[];
      findings: Record<string, unknown>;
      recommendations: string;
    }>) => {
      const updateData: Record<string, unknown> = {};
      
      if (updates.customer_id !== undefined) updateData.customer_id = updates.customer_id;
      if (updates.project_id !== undefined) updateData.project_id = updates.project_id;
      if (updates.inspector_id !== undefined) updateData.inspector_id = updates.inspector_id;
      if (updates.inspection_date !== undefined) updateData.inspection_date = updates.inspection_date;
      if (updates.inspection_type !== undefined) updateData.inspection_type = updates.inspection_type;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.overall_condition !== undefined) updateData.overall_condition = updates.overall_condition;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.photos !== undefined) updateData.photos = updates.photos as Json;
      if (updates.findings !== undefined) updateData.findings = updates.findings as Json;
      if (updates.recommendations !== undefined) updateData.recommendations = updates.recommendations;

      const { data, error } = await supabase
        .from("roof_inspections")
        .update(updateData)
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
