import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo } from "react";
import type { Asset } from "./useAssets";
import { assetAccrual, type AssetAccrual } from "@/lib/assetBilling";

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
  location_id: string | null;
  billable: boolean;
  day_rate: number | null;
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
            metadata,
            default_day_rate
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
      queryClient.invalidateQueries({ queryKey: ["location-authorization"] });
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
      // Stop the per-diem clock at return time unless it was already ended earlier.
      if (!error) await supabase.from("asset_assignments").update({ end_at: new Date().toISOString() }).eq("id", assignmentId).is("end_at", null);

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
      queryClient.invalidateQueries({ queryKey: ["location-authorization"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["location-roster-assets"] });
      queryClient.invalidateQueries({ queryKey: ["location-command-center"] });
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
      queryClient.invalidateQueries({ queryKey: ["location-authorization"] });
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
      queryClient.invalidateQueries({ queryKey: ["location-authorization"] });
      toast.success("Assignment updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update assignment: ${error.message}`);
    },
  });
}

// ---------- Location + per-diem billing (same asset_assignments rows) ----------

export interface AssetBillingRow extends AssetAssignmentWithDetails, AssetAccrual {}

/** One query (shared with ProjectAssetAssignmentsSection) + per-diem math. Includes ended/returned rows for billing. */
export function useProjectAssetBilling(projectId: string | undefined) {
  const q = useAssetAssignmentsByProject(projectId);
  const rows = useMemo<AssetBillingRow[]>(() => (q.data ?? []).map((a) => ({
    ...a,
    ...assetAccrual({
      billable: !!a.billable, start_at: a.start_at,
      end_at: a.end_at ?? (a.status !== "active" ? a.unassigned_at : null),
      day_rate: a.day_rate, default_day_rate: a.assets?.default_day_rate ?? null,
    }),
  })), [q.data]);
  const billable = rows.filter((r) => r.billable);
  const equipmentTotal = billable.reduce((t, r) => t + (r.accrued ?? 0), 0);
  const missingRate = billable.filter((r) => r.accrued == null).length;
  return { ...q, rows, billable, equipmentTotal, missingRate };
}

export interface AssignToLocationInput {
  projectId: string;
  locationId: string | null;
  /** Existing project assignment to move/update; omit to create a new project assignment for assetId. */
  assignmentId?: string;
  assetId?: string;
  billable?: boolean;
  dayRate?: number | null;
  startAt?: string;
}

const ASSET_KEYS = ["asset-assignments", "location-authorization", "assets", "location-roster-assets", "location-command-center"];
const invalidateAssetViews = (qc: ReturnType<typeof useQueryClient>) => ASSET_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

/**
 * Place an asset at a location (or project-wide). Moving to a different location never rewrites
 * the old row: it is closed as "transferred" (end_at = move time) and a new row is inserted, so
 * per-diem history and location billing stay intact. Same-location calls only update billing.
 */
export function useAssignAssetToLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: AssignToLocationInput): Promise<"updated" | "moved" | "assigned"> => {
      const { data: { user } } = await supabase.auth.getUser();
      const billing = i.billable === undefined ? {} : { billable: i.billable, day_rate: i.dayRate ?? null };
      const at = i.startAt ?? new Date().toISOString();
      let assetId = i.assetId;
      let carry: { billable: boolean; day_rate: number | null } | null = null;
      if (i.assignmentId) {
        const { data: cur, error } = await supabase.from("asset_assignments")
          .select("id, asset_id, location_id, project_id, billable, day_rate, end_at, status").eq("id", i.assignmentId).single();
        if (error) throw error;
        const open = cur.status === "active" && !cur.end_at;
        if (open && cur.location_id === i.locationId && cur.project_id === i.projectId) {
          const { error: e } = await supabase.from("asset_assignments").update(billing).eq("id", cur.id);
          if (e) throw e;
          return "updated";
        }
        assetId = cur.asset_id;
        carry = { billable: !!cur.billable, day_rate: cur.day_rate };
      }
      if (!assetId) throw new Error("Pick an asset");
      // Close every open placement of this asset (any project/location) before the new one starts.
      const { data: openRows, error: oe } = await supabase.from("asset_assignments")
        .select("id, end_at").eq("asset_id", assetId).eq("status", "active").is("unassigned_at", null);
      if (oe) throw oe;
      for (const r of openRows ?? []) {
        const { error: ce } = await supabase.from("asset_assignments").update({
          status: "transferred", unassigned_at: at, unassigned_by: user?.id ?? null,
          unassigned_reason: "transferred", end_at: r.end_at ?? at,
        }).eq("id", r.id);
        if (ce) throw ce;
      }
      const { error } = await supabase.from("asset_assignments").insert({
        project_id: i.projectId, asset_id: assetId, location_id: i.locationId,
        assigned_by: user?.id ?? null, start_at: at, ...(carry ?? {}), ...billing,
      });
      if (error) throw error;
      await supabase.from("assets").update({ status: "assigned" }).eq("id", assetId);
      return (openRows?.length ?? 0) > 0 ? "moved" : "assigned";
    },
    onSuccess: (r) => {
      invalidateAssetViews(qc);
      toast.success(r === "updated" ? "Asset updated" : r === "moved" ? "Asset moved" : "Asset assigned");
    },
    onError: (e: Error) => toast.error(`Failed to assign asset: ${e.message}`),
  });
}

/** Stops the per-diem clock (sets end_at); the assignment row stays for history/billing. */
export function useEndAssetAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from("asset_assignments").update({ end_at: new Date().toISOString() }).eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-assignments"] });
      invalidateAssetViews(qc);
      toast.success("Asset assignment ended");
    },
    onError: (e: Error) => toast.error(`Failed to end assignment: ${e.message}`),
  });
}
