import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Asset } from "./useAssets";

export interface AssetAssignment {
  id: string;
  project_id: string;
  asset_id: string;
  assigned_to_personnel_id: string | null;
  assigned_by: string | null;
  start_at: string;
  end_at: string | null;
  unassigned_at: string | null;
  unassigned_by: string | null;
  unassigned_reason: string | null;
  unassigned_notes: string | null;
  notes: string | null;
  status: "active" | "returned" | "transferred";
  created_at: string;
  updated_at: string;
}

export interface AssetAssignmentWithDetails extends AssetAssignment {
  assets: Asset | null;
  personnel?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  } | null;
  projects?: {
    id: string;
    name: string;
  } | null;
}

interface AssetAssignmentFilters {
  status?: string;
  type?: string;
  personnelId?: string;
  search?: string;
}

// Get all asset assignments for a project
export function useAssetAssignmentsByProject(projectId: string | undefined, filters: AssetAssignmentFilters = {}) {
  return useQuery({
    queryKey: ["asset-assignments", "by-project", projectId, filters],
    queryFn: async () => {
      if (!projectId) return [];

      let query = supabase
        .from("asset_assignments")
        .select(`
          *,
          assets (
            id,
            type,
            label,
            description,
            address,
            gate_code,
            access_instructions,
            operating_hours,
            instructions,
            serial_number,
            status,
            metadata
          ),
          personnel (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by asset type if specified
      let results = data as AssetAssignmentWithDetails[];
      if (filters.type && filters.type !== "all") {
        results = results.filter(a => a.assets?.type === filters.type);
      }
      if (filters.personnelId && filters.personnelId !== "all") {
        results = results.filter(a => a.assigned_to_personnel_id === filters.personnelId);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(a => 
          a.assets?.label?.toLowerCase().includes(searchLower) ||
          a.assets?.description?.toLowerCase().includes(searchLower) ||
          a.personnel?.first_name?.toLowerCase().includes(searchLower) ||
          a.personnel?.last_name?.toLowerCase().includes(searchLower)
        );
      }

      return results;
    },
    enabled: !!projectId,
  });
}

// Get all asset assignments for a personnel member
export function useAssetAssignmentsByPersonnel(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["asset-assignments", "by-personnel", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];

      const { data, error } = await supabase
        .from("asset_assignments")
        .select(`
          *,
          assets (
            id,
            type,
            label,
            description,
            address,
            serial_number,
            status
          ),
          projects (
            id,
            name
          )
        `)
        .eq("assigned_to_personnel_id", personnelId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AssetAssignmentWithDetails[];
    },
    enabled: !!personnelId,
  });
}

export interface AssignAssetInput {
  projectId: string;
  assetId: string;
  personnelId?: string;
  startAt?: string;
  endAt?: string;
  notes?: string;
}

// Assign an asset to a project (and optionally a personnel member)
export function useAssignAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, assetId, personnelId, startAt, endAt, notes }: AssignAssetInput) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("asset_assignments")
        .insert({
          project_id: projectId,
          asset_id: assetId,
          assigned_to_personnel_id: personnelId || null,
          assigned_by: user?.id || null,
          start_at: startAt || new Date().toISOString(),
          end_at: endAt || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Update asset status to assigned
      await supabase
        .from("assets")
        .update({ status: "assigned" })
        .eq("id", assetId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Asset assigned successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign asset: ${error.message}`);
    },
  });
}

// Unassign an asset (mark as returned)
export function useUnassignAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Get the assignment to find the asset
      const { data: assignment } = await supabase
        .from("asset_assignments")
        .select("asset_id")
        .eq("id", assignmentId)
        .single();

      const { error } = await supabase
        .from("asset_assignments")
        .update({
          status: "returned",
          unassigned_at: new Date().toISOString(),
          unassigned_by: user?.id || null,
        })
        .eq("id", assignmentId);

      if (error) throw error;

      // Check if asset has any other active assignments
      if (assignment?.asset_id) {
        const { data: activeAssignments } = await supabase
          .from("asset_assignments")
          .select("id")
          .eq("asset_id", assignment.asset_id)
          .eq("status", "active")
          .is("unassigned_at", null);

        // If no other active assignments, mark asset as available
        if (!activeAssignments?.length) {
          await supabase
            .from("assets")
            .update({ status: "available" })
            .eq("id", assignment.asset_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Asset unassigned successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to unassign asset: ${error.message}`);
    },
  });
}

// Bulk unassign assets
export function useBulkUnassignAssets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Get all assignments to find the assets
      const { data: assignments } = await supabase
        .from("asset_assignments")
        .select("id, asset_id")
        .in("id", assignmentIds);

      const { error } = await supabase
        .from("asset_assignments")
        .update({
          status: "returned",
          unassigned_at: new Date().toISOString(),
          unassigned_by: user?.id || null,
        })
        .in("id", assignmentIds);

      if (error) throw error;

      // Update asset statuses
      const assetIds = [...new Set(assignments?.map(a => a.asset_id) || [])];
      for (const assetId of assetIds) {
        const { data: activeAssignments } = await supabase
          .from("asset_assignments")
          .select("id")
          .eq("asset_id", assetId)
          .eq("status", "active")
          .is("unassigned_at", null);

        if (!activeAssignments?.length) {
          await supabase
            .from("assets")
            .update({ status: "available" })
            .eq("id", assetId);
        }
      }

      return { count: assignmentIds.length };
    },
    onSuccess: ({ count }) => {
      queryClient.invalidateQueries({ queryKey: ["asset-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success(`${count} asset(s) unassigned successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to unassign assets: ${error.message}`);
    },
  });
}

// Transfer asset to different personnel
export function useTransferAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assignmentId, newPersonnelId }: { assignmentId: string; newPersonnelId: string | null }) => {
      const { error } = await supabase
        .from("asset_assignments")
        .update({ assigned_to_personnel_id: newPersonnelId })
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-assignments"] });
      toast.success("Asset transferred successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to transfer asset: ${error.message}`);
    },
  });
}

// Update assignment notes
export function useUpdateAssetAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assignmentId, updates }: { assignmentId: string; updates: Partial<AssetAssignment> }) => {
      const { data, error } = await supabase
        .from("asset_assignments")
        .update(updates)
        .eq("id", assignmentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-assignments"] });
      toast.success("Assignment updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update assignment: ${error.message}`);
    },
  });
}
