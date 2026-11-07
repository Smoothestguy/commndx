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
  ownership?: "owned" | "rented";
  vendor_id?: string | null;
  vendor_name?: string | null;
  unit_cost?: number | null;
  rental_rate?: number | null;
  rental_period?: "day" | "week" | "month";
  notes?: string | null;
  default_day_rate?: number | null;
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
      const { data, error } = await supabase.rpc("asset_catalog");
      if (error) throw error;
      let rows = (data ?? []) as unknown as Asset[];
      if (filters.type && filters.type !== "all") rows = rows.filter(a => a.type === filters.type);
      if (filters.status && filters.status !== "all") rows = rows.filter(a => a.status === filters.status);
      if (filters.search) { const search = filters.search.toLowerCase(); rows = rows.filter(a => [a.label,a.description,a.serial_number].some(v => v?.toLowerCase().includes(search))); }
      return rows;

    },
  });
}

// Get a single asset by ID
export function useAsset(assetId: string | undefined) {
  return useQuery({
    queryKey: ["assets", assetId],
    queryFn: async () => {
      if (!assetId) return null;

      const { data, error } = await supabase.rpc("asset_catalog");
      if (error) throw error;
      return ((data ?? []) as unknown as Asset[]).find(a => a.id === assetId) ?? null;

    },
    enabled: !!assetId,
  });
}

// Get available assets (not currently assigned to active assignments)
export function useAvailableAssets() {
  return useQuery({
    queryKey: ["assets", "available"],
    queryFn: async () => {
      const [{ data: catalog, error }, { data: placements, error: placementError }] = await Promise.all([
        supabase.rpc("asset_catalog"), supabase.rpc("asset_placements"),
      ]);
      if (error) throw error;
      if (placementError) throw placementError;
      const active = new Set(((placements ?? []) as unknown as {asset_id:string;status:string;end_at:string|null;unassigned_at:string|null}[]).filter(p => p.status === 'active' && !p.end_at && !p.unassigned_at).map(p => p.asset_id));
      return ((catalog ?? []) as unknown as Asset[]).filter(a => a.status !== 'retired' && !active.has(a.id));
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
  ownership?: "owned" | "rented";
  vendor_id?: string | null;
  vendor_name?: string | null;
  unit_cost?: number | null;
  rental_rate?: number | null;
  rental_period?: "day" | "week" | "month";
  notes?: string | null;
  default_day_rate?: number | null;
  status?: AssetStatus;
  ownership?: "owned" | "rented";
  vendor_id?: string | null;
  unit_cost?: number | null;
  rental_rate?: number | null;
  rental_period?: "day" | "week" | "month";
  notes?: string | null;
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
        ownership: input.ownership ?? 'owned', vendor_id: input.ownership === 'rented' ? input.vendor_id ?? null : null,
        unit_cost: input.unit_cost ?? null, rental_rate: input.rental_rate ?? null, rental_period: input.rental_period ?? 'day', notes: input.notes ?? null,
        default_day_rate: input.default_day_rate ?? null,
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
  ownership?: "owned" | "rented";
  vendor_id?: string | null;
  vendor_name?: string | null;
  unit_cost?: number | null;
  rental_rate?: number | null;
  rental_period?: "day" | "week" | "month";
  notes?: string | null;
  default_day_rate?: number | null;
  status?: AssetStatus;
  ownership?: "owned" | "rented";
  vendor_id?: string | null;
  unit_cost?: number | null;
  rental_rate?: number | null;
  rental_period?: "day" | "week" | "month";
  notes?: string | null;
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
      queryClient.invalidateQueries({ queryKey: ["asset-assignments"] }); // joined default_day_rate drives billing
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
