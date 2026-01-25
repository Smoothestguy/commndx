import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface Asset {
  id: string;
  type: string;
  label: string;
  description: string | null;
  address: string | null;
  gate_code: string | null;
  access_instructions: string | null;
  operating_hours: string | null;
  instructions: string | null;
  serial_number: string | null;
  status: "available" | "assigned" | "maintenance" | "retired";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  deleted_at: string | null;
}

export type AssetType = "vehicle" | "equipment" | "location" | "key" | "badge" | "tool" | "device" | "other";
export type AssetStatus = "available" | "assigned" | "maintenance" | "retired";

export const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "vehicle", label: "Vehicle" },
  { value: "equipment", label: "Equipment" },
  { value: "location", label: "Location" },
  { value: "key", label: "Key" },
  { value: "badge", label: "Badge" },
  { value: "tool", label: "Tool" },
  { value: "device", label: "Device" },
  { value: "other", label: "Other" },
];

export const ASSET_STATUSES: { value: AssetStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "assigned", label: "Assigned" },
  { value: "maintenance", label: "Maintenance" },
  { value: "retired", label: "Retired" },
];

interface AssetFilters {
  type?: string;
  status?: string;
  search?: string;
}

// Get all non-deleted assets with optional filters
export function useAssets(filters: AssetFilters = {}) {
  return useQuery({
    queryKey: ["assets", filters],
    queryFn: async () => {
      let query = supabase
        .from("assets")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (filters.type && filters.type !== "all") {
        query = query.eq("type", filters.type);
      }
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters.search) {
        query = query.or(`label.ilike.%${filters.search}%,description.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Asset[];
    },
  });
}

// Get a single asset by ID
export function useAsset(assetId: string | undefined) {
  return useQuery({
    queryKey: ["assets", assetId],
    queryFn: async () => {
      if (!assetId) return null;

      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("id", assetId)
        .is("deleted_at", null)
        .single();

      if (error) throw error;
      return data as Asset;
    },
    enabled: !!assetId,
  });
}

// Get available assets (not currently assigned to active assignments)
export function useAvailableAssets() {
  return useQuery({
    queryKey: ["assets", "available"],
    queryFn: async () => {
      // Get all assets that are not retired and not in active assignments
      const { data: assets, error: assetsError } = await supabase
        .from("assets")
        .select("*")
        .is("deleted_at", null)
        .neq("status", "retired")
        .order("label");

      if (assetsError) throw assetsError;

      // Get active assignment asset IDs
      const { data: activeAssignments, error: assignmentsError } = await supabase
        .from("asset_assignments")
        .select("asset_id")
        .eq("status", "active")
        .is("unassigned_at", null);

      if (assignmentsError) throw assignmentsError;

      const assignedAssetIds = new Set(activeAssignments?.map(a => a.asset_id) || []);

      // Filter to assets not currently assigned
      return (assets || []).filter(asset => !assignedAssetIds.has(asset.id)) as Asset[];
    },
  });
}

export interface CreateAssetInput {
  type: string;
  label: string;
  description?: string;
  address?: string;
  gate_code?: string;
  access_instructions?: string;
  operating_hours?: string;
  instructions?: string;
  serial_number?: string;
  status?: AssetStatus;
  metadata?: Json;
}

// Create a new asset
export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAssetInput) => {
      const { data: { user } } = await supabase.auth.getUser();

      const insertData = {
        type: input.type,
        label: input.label,
        description: input.description,
        address: input.address,
        gate_code: input.gate_code,
        access_instructions: input.access_instructions,
        operating_hours: input.operating_hours,
        instructions: input.instructions,
        serial_number: input.serial_number,
        status: input.status || "available",
        metadata: input.metadata || {},
        created_by: user?.id || null,
      };

      const { data, error } = await supabase
        .from("assets")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data as Asset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Asset created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create asset: ${error.message}`);
    },
  });
}

export interface UpdateAssetInput {
  id: string;
  type?: string;
  label?: string;
  description?: string | null;
  address?: string | null;
  gate_code?: string | null;
  access_instructions?: string | null;
  operating_hours?: string | null;
  instructions?: string | null;
  serial_number?: string | null;
  status?: AssetStatus;
  metadata?: Json;
}

// Update an existing asset
export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateAssetInput) => {
      const { data, error } = await supabase
        .from("assets")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Asset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Asset updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update asset: ${error.message}`);
    },
  });
}

// Soft delete an asset
export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string) => {
      const { error } = await supabase
        .from("assets")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", assetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Asset deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete asset: ${error.message}`);
    },
  });
}
