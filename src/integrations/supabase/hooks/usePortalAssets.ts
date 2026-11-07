import type { AssetAssignmentWithDetails } from './useAssetAssignments';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PortalAssignedAsset {
  id: string;
  project_id: string;
  asset_id: string;
  start_at: string;
  end_at: string | null;
  notes: string | null;
  project: {
    id: string;
    name: string;
  } | null;
  asset: {
    id: string;
    type: string;
    label: string;
    description: string | null;
    address: string | null;
    gate_code: string | null;
    access_instructions: string | null;
    operating_hours: string | null;
    instructions: string | null;
  } | null;
}

export function usePersonnelAssignedAssets(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["portal-assigned-assets", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];

      const { data: projection, error } = await supabase.rpc('asset_placements', { p_personnel_id: personnelId });
      const data = ((projection ?? []) as unknown as AssetAssignmentWithDetails[]).filter(a => a.status === 'active' && !a.unassigned_at);

      if (error) throw error;

      // Filter expired assignments and transform data structure
      const now = new Date();
      return (data || [])
        .filter(a => {
          if (!a.end_at) return true;
          return new Date(a.end_at) > now;
        })
        .map(a => ({
          id: a.id,
          project_id: a.project_id,
          asset_id: a.asset_id,
          start_at: a.start_at,
          end_at: a.end_at,
          notes: null,
          project: a.projects as PortalAssignedAsset["project"],
          asset: a.assets as PortalAssignedAsset["asset"],
        })) as PortalAssignedAsset[];
    },
    enabled: !!personnelId,
  });
}

// Get assets for a specific project
export function usePersonnelProjectAssets(personnelId: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ["portal-project-assets", personnelId, projectId],
    queryFn: async () => {
      if (!personnelId || !projectId) return [];

      const { data: projection, error } = await supabase.rpc('asset_placements', { p_personnel_id: personnelId, p_project_id: projectId });
      const data = ((projection ?? []) as unknown as AssetAssignmentWithDetails[]).filter(a => a.status === 'active' && !a.unassigned_at);

      if (error) throw error;

      // Filter expired assignments
      const now = new Date();
      return (data || [])
        .filter(a => {
          if (!a.end_at) return true;
          return new Date(a.end_at) > now;
        })
        .map(a => ({
          id: a.id,
          project_id: a.project_id,
          asset_id: a.asset_id,
          start_at: a.start_at,
          end_at: a.end_at,
          notes: null,
          project: null,
          asset: a.assets as PortalAssignedAsset["asset"],
        })) as PortalAssignedAsset[];
    },
    enabled: !!personnelId && !!projectId,
  });
}
