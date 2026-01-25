import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PersonnelAsset {
  assetId: string;
  type: string;
  label: string;
  address: string | null;
  accessHours: string | null;
  instructions: string | null;
  endAt: string | null;
  assignmentId: string;
}

export interface PersonnelWithAssets {
  personnelId: string;
  assignmentId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  payRate: number | null;
  rateBracket: string | null;
  rateBracketId: string | null;
  billRate: number | null;
  assignedAt: string | null;
  assets: PersonnelAsset[];
}

interface UsePersonnelWithAssetsOptions {
  includeUnassigned?: boolean;
}

// Fetch all assigned personnel for a project with their active asset assignments
export function usePersonnelWithAssets(
  projectId: string | undefined,
  options: UsePersonnelWithAssetsOptions = {}
) {
  const { includeUnassigned = false } = options;
  
  return useQuery({
    queryKey: ["personnel-with-assets", projectId, { includeUnassigned }],
    queryFn: async (): Promise<(PersonnelWithAssets & {
      status: string;
      unassignedAt: string | null;
      unassignedReason: string | null;
      unassignedNotes: string | null;
    })[]> => {
      if (!projectId) return [];

      // Build the status filter
      const statusFilter = includeUnassigned 
        ? ["active", "unassigned", "removed"]
        : ["active"];

      // First, get all personnel assigned to the project
      const { data: assignments, error: assignmentsError } = await supabase
        .from("personnel_project_assignments")
        .select(`
          id,
          personnel_id,
          assigned_at,
          bill_rate,
          pay_rate,
          rate_bracket_id,
          status,
          unassigned_at,
          unassigned_reason,
          unassigned_notes,
          personnel!inner (
            id,
            first_name,
            last_name,
            email,
            phone,
            city,
            state,
            pay_rate,
            status
          ),
          project_rate_brackets (
            id,
            name,
            bill_rate
          )
        `)
        .eq("project_id", projectId)
        .in("status", statusFilter)
        .eq("personnel.status", "active");

      if (assignmentsError) throw assignmentsError;
      if (!assignments || assignments.length === 0) return [];

      // Get all active asset assignments for this project
      const { data: assetAssignments, error: assetError } = await supabase
        .from("asset_assignments")
        .select(`
          id,
          asset_id,
          assigned_to_personnel_id,
          end_at,
          assets (
            id,
            type,
            label,
            address,
            operating_hours,
            instructions
          )
        `)
        .eq("project_id", projectId)
        .eq("status", "active")
        .is("unassigned_at", null);

      if (assetError) throw assetError;

      // Build a map of personnel_id -> assets
      const personnelAssetsMap = new Map<string, PersonnelAsset[]>();
      
      (assetAssignments || []).forEach((aa) => {
        if (aa.assigned_to_personnel_id && aa.assets) {
          const personnelId = aa.assigned_to_personnel_id;
          if (!personnelAssetsMap.has(personnelId)) {
            personnelAssetsMap.set(personnelId, []);
          }
          
          // Filter out assets with end_at in the past
          const endAt = aa.end_at ? new Date(aa.end_at) : null;
          if (endAt && endAt < new Date()) {
            return; // Skip expired assets
          }
          
          personnelAssetsMap.get(personnelId)!.push({
            assetId: aa.asset_id,
            type: aa.assets.type,
            label: aa.assets.label,
            address: aa.assets.address,
            accessHours: aa.assets.operating_hours,
            instructions: aa.assets.instructions,
            endAt: aa.end_at,
            assignmentId: aa.id,
          });
        }
      });

      // Combine personnel with their assets
      return assignments.map((a) => {
        const personnel = a.personnel as {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          city: string | null;
          state: string | null;
          pay_rate: number | null;
          status: string;
        };
        const rateBracket = a.project_rate_brackets as {
          id: string;
          name: string;
          bill_rate: number;
        } | null;

        // Pay rate priority: assignment pay_rate > personnel pay_rate
        const payRate = (a as any).pay_rate ?? personnel.pay_rate ?? null;

        return {
          personnelId: a.personnel_id,
          assignmentId: a.id,
          name: `${personnel.first_name} ${personnel.last_name}`,
          firstName: personnel.first_name,
          lastName: personnel.last_name,
          email: personnel.email,
          phone: personnel.phone,
          city: personnel.city,
          state: personnel.state,
          payRate: payRate,
          rateBracket: rateBracket?.name || null,
          rateBracketId: a.rate_bracket_id,
          billRate: a.bill_rate ?? rateBracket?.bill_rate ?? null,
          assignedAt: a.assigned_at,
          assets: personnelAssetsMap.get(a.personnel_id) || [],
          status: a.status,
          unassignedAt: a.unassigned_at,
          unassignedReason: a.unassigned_reason,
          unassignedNotes: a.unassigned_notes,
        };
      });
    },
    enabled: !!projectId,
  });
}

// For export - get all data including restricted fields for admins
export function usePersonnelWithAssetsForExport(projectId: string | undefined, isAdmin: boolean) {
  return useQuery({
    queryKey: ["personnel-with-assets-export", projectId, isAdmin],
    queryFn: async (): Promise<PersonnelWithAssets[]> => {
      if (!projectId) return [];

      // Same query as above - the access_codes field restriction is handled at export time
      const { data: assignments, error: assignmentsError } = await supabase
        .from("personnel_project_assignments")
        .select(`
          id,
          personnel_id,
          assigned_at,
          bill_rate,
          pay_rate,
          rate_bracket_id,
          personnel!inner (
            id,
            first_name,
            last_name,
            email,
            phone,
            city,
            state,
            pay_rate,
            status
          ),
          project_rate_brackets (
            id,
            name,
            bill_rate
          )
        `)
        .eq("project_id", projectId)
        .eq("status", "active")
        .eq("personnel.status", "active");

      if (assignmentsError) throw assignmentsError;
      if (!assignments || assignments.length === 0) return [];

      // Get all active asset assignments for this project - include gate_code for admins
      const selectFields = isAdmin
        ? `
          id,
          asset_id,
          assigned_to_personnel_id,
          start_at,
          end_at,
          assets (
            id,
            type,
            label,
            address,
            gate_code,
            operating_hours,
            instructions
          )
        `
        : `
          id,
          asset_id,
          assigned_to_personnel_id,
          start_at,
          end_at,
          assets (
            id,
            type,
            label,
            address,
            operating_hours,
            instructions
          )
        `;

      const { data: assetAssignments, error: assetError } = await supabase
        .from("asset_assignments")
        .select(selectFields)
        .eq("project_id", projectId)
        .eq("status", "active")
        .is("unassigned_at", null);

      if (assetError) throw assetError;

      // Build a map of personnel_id -> assets
      const personnelAssetsMap = new Map<string, (PersonnelAsset & { startAt?: string; accessCode?: string })[]>();
      
      (assetAssignments || []).forEach((aa: any) => {
        if (aa.assigned_to_personnel_id && aa.assets) {
          const personnelId = aa.assigned_to_personnel_id;
          if (!personnelAssetsMap.has(personnelId)) {
            personnelAssetsMap.set(personnelId, []);
          }
          
          // Filter out assets with end_at in the past
          const endAt = aa.end_at ? new Date(aa.end_at) : null;
          if (endAt && endAt < new Date()) {
            return; // Skip expired assets
          }
          
          personnelAssetsMap.get(personnelId)!.push({
            assetId: aa.asset_id,
            type: aa.assets.type,
            label: aa.assets.label,
            address: aa.assets.address,
            accessHours: aa.assets.operating_hours,
            instructions: aa.assets.instructions,
            endAt: aa.end_at,
            assignmentId: aa.id,
            startAt: aa.start_at,
            accessCode: isAdmin ? aa.assets.gate_code : undefined,
          });
        }
      });

      // Combine personnel with their assets
      return assignments.map((a) => {
        const personnel = a.personnel as {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          city: string | null;
          state: string | null;
          pay_rate: number | null;
          status: string;
        };
        const rateBracket = a.project_rate_brackets as {
          id: string;
          name: string;
          bill_rate: number;
        } | null;

        // Pay rate priority: assignment pay_rate > personnel pay_rate
        const payRate = (a as any).pay_rate ?? personnel.pay_rate ?? null;

        return {
          personnelId: a.personnel_id,
          assignmentId: a.id,
          name: `${personnel.first_name} ${personnel.last_name}`,
          firstName: personnel.first_name,
          lastName: personnel.last_name,
          email: personnel.email,
          phone: personnel.phone,
          city: personnel.city,
          state: personnel.state,
          payRate: payRate,
          rateBracket: rateBracket?.name || null,
          rateBracketId: a.rate_bracket_id,
          billRate: a.bill_rate ?? rateBracket?.bill_rate ?? null,
          assignedAt: a.assigned_at,
          assets: personnelAssetsMap.get(a.personnel_id) || [],
        };
      });
    },
    enabled: !!projectId,
  });
}
