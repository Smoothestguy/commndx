import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface ProjectUnit {
  id: string;
  project_id: string;
  unit_number: string;
  unit_name: string | null;
  floor: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface UnitScopeItem {
  id: string;
  unit_id: string;
  jo_line_item_id: string;
  quantity: number;
  assigned_vendor_id: string | null;
  status: "not_started" | "in_progress" | "complete" | "verified";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnitScopeItemWithDetails extends UnitScopeItem {
  vendor_name?: string;
  jo_description?: string;
}

export interface UnitWithScopeItems extends ProjectUnit {
  scope_items: UnitScopeItemWithDetails[];
}

// Fetch all units for a project with their scope items
export const useProjectUnits = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ["project_units", projectId],
    queryFn: async () => {
      const { data: units, error: unitsError } = await supabase
        .from("project_units")
        .select("*")
        .eq("project_id", projectId!)
        .order("unit_number");

      if (unitsError) throw unitsError;

      // Fetch scope items for all units
      const unitIds = units.map((u: any) => u.id);
      if (unitIds.length === 0) return [] as UnitWithScopeItems[];

      const { data: scopeItems, error: scopeError } = await supabase
        .from("unit_scope_items")
        .select("*")
        .in("unit_id", unitIds);

      if (scopeError) throw scopeError;

      // Get vendor names for assigned vendors
      const vendorIds = [...new Set((scopeItems || []).map((s: any) => s.assigned_vendor_id).filter(Boolean))];
      let vendorMap: Record<string, string> = {};
      if (vendorIds.length > 0) {
        const { data: vendors } = await supabase
          .from("vendors")
          .select("id, name")
          .in("id", vendorIds);
        vendorMap = Object.fromEntries((vendors || []).map((v: any) => [v.id, v.name]));
      }

      // Get JO line item descriptions
      const joLineItemIds = [...new Set((scopeItems || []).map((s: any) => s.jo_line_item_id))];
      let joMap: Record<string, string> = {};
      if (joLineItemIds.length > 0) {
        const { data: joItems } = await supabase
          .from("job_order_line_items")
          .select("id, description")
          .in("id", joLineItemIds);
        joMap = Object.fromEntries((joItems || []).map((j: any) => [j.id, j.description]));
      }

      return units.map((unit: any) => ({
        ...unit,
        scope_items: (scopeItems || [])
          .filter((s: any) => s.unit_id === unit.id)
          .map((s: any) => ({
            ...s,
            vendor_name: vendorMap[s.assigned_vendor_id] || undefined,
            jo_description: joMap[s.jo_line_item_id] || undefined,
          })),
      })) as UnitWithScopeItems[];
    },
    enabled: !!projectId,
  });
};

// Get allocation summary for JO line items (total assigned across all units)
export const useJOLineItemAllocations = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ["jo_line_item_allocations", projectId],
    queryFn: async () => {
      // Get all JO line items for this project's job orders
      const { data: jobOrders, error: joError } = await supabase
        .from("job_orders")
        .select("id")
        .eq("project_id", projectId!)
        .is("deleted_at", null);

      if (joError) throw joError;

      const joIds = (jobOrders || []).map((j: any) => j.id);
      if (joIds.length === 0) return [];

      const { data: lineItems, error: liError } = await supabase
        .from("job_order_line_items")
        .select("id, description, quantity, job_order_id")
        .in("job_order_id", joIds);

      if (liError) throw liError;

      // Get all unit scope items that reference these line items
      const lineItemIds = (lineItems || []).map((l: any) => l.id);
      if (lineItemIds.length === 0) {
        return (lineItems || []).map((li: any) => ({
          ...li,
          total_quantity: li.quantity,
          assigned_quantity: 0,
          remaining_quantity: li.quantity,
        }));
      }

      const { data: scopeItems, error: siError } = await supabase
        .from("unit_scope_items")
        .select("jo_line_item_id, quantity")
        .in("jo_line_item_id", lineItemIds);

      if (siError) throw siError;

      // Build allocation map
      const allocationMap: Record<string, number> = {};
      (scopeItems || []).forEach((s: any) => {
        allocationMap[s.jo_line_item_id] = (allocationMap[s.jo_line_item_id] || 0) + s.quantity;
      });

      return (lineItems || []).map((li: any) => ({
        ...li,
        total_quantity: li.quantity,
        assigned_quantity: allocationMap[li.id] || 0,
        remaining_quantity: li.quantity - (allocationMap[li.id] || 0),
      }));
    },
    enabled: !!projectId,
  });
};

// Add a project unit
export const useAddProjectUnit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { project_id: string; unit_number: string; unit_name?: string; floor?: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: unit, error } = await supabase
        .from("project_units")
        .insert([{ ...data, created_by: user?.id }])
        .select()
        .single();

      if (error) throw error;
      return unit;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project_units", variables.project_id] });
      toast.success("Unit added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add unit: ${error.message}`);
    },
  });
};

// Update a project unit
export const useUpdateProjectUnit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; project_id: string; unit_number?: string; unit_name?: string; floor?: string; notes?: string }) => {
      const { id, project_id, ...updates } = data;
      const { data: unit, error } = await supabase
        .from("project_units")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return unit;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project_units", variables.project_id] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update unit: ${error.message}`);
    },
  });
};

// Delete a project unit
export const useDeleteProjectUnit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; project_id: string }) => {
      const { error } = await supabase
        .from("project_units")
        .delete()
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project_units", variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ["jo_line_item_allocations", variables.project_id] });
      toast.success("Unit deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete unit: ${error.message}`);
    },
  });
};

// Add/update scope item for a unit
export const useUpsertUnitScopeItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      project_id: string;
      unit_id: string;
      jo_line_item_id: string;
      quantity: number;
      assigned_vendor_id?: string | null;
      status?: "not_started" | "in_progress" | "complete" | "verified";
      notes?: string;
    }) => {
      const { project_id, ...itemData } = data;

      // Check if scope item already exists for this unit + line item combo
      const { data: existing } = await supabase
        .from("unit_scope_items")
        .select("id")
        .eq("unit_id", itemData.unit_id)
        .eq("jo_line_item_id", itemData.jo_line_item_id)
        .maybeSingle();

      if (existing) {
        const { data: updated, error } = await supabase
          .from("unit_scope_items")
          .update(itemData)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return updated;
      } else {
        const { data: inserted, error } = await supabase
          .from("unit_scope_items")
          .insert([itemData])
          .select()
          .single();
        if (error) throw error;
        return inserted;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project_units", variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ["jo_line_item_allocations", variables.project_id] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update scope item: ${error.message}`);
    },
  });
};

// Delete scope item
export const useDeleteUnitScopeItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; project_id: string }) => {
      const { error } = await supabase
        .from("unit_scope_items")
        .delete()
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project_units", variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ["jo_line_item_allocations", variables.project_id] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete scope item: ${error.message}`);
    },
  });
};

// Bulk add units (for import)
export const useBulkAddUnits = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      project_id: string;
      units: Array<{
        unit_number: string;
        unit_name?: string;
        floor?: string;
        scope_items?: Array<{
          jo_line_item_id: string;
          quantity: number;
          assigned_vendor_id?: string;
        }>;
      }>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Insert units
      const unitInserts = data.units.map((u) => ({
        project_id: data.project_id,
        unit_number: u.unit_number,
        unit_name: u.unit_name || null,
        floor: u.floor || null,
        created_by: user?.id,
      }));

      const { data: insertedUnits, error: unitError } = await supabase
        .from("project_units")
        .insert(unitInserts)
        .select();

      if (unitError) throw unitError;

      // Insert scope items
      const scopeInserts: any[] = [];
      data.units.forEach((u, idx) => {
        if (u.scope_items && insertedUnits[idx]) {
          u.scope_items.forEach((si) => {
            scopeInserts.push({
              unit_id: insertedUnits[idx].id,
              jo_line_item_id: si.jo_line_item_id,
              quantity: si.quantity,
              assigned_vendor_id: si.assigned_vendor_id || null,
            });
          });
        }
      });

      if (scopeInserts.length > 0) {
        const { error: scopeError } = await supabase
          .from("unit_scope_items")
          .insert(scopeInserts);
        if (scopeError) throw scopeError;
      }

      return insertedUnits;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project_units", variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ["jo_line_item_allocations", variables.project_id] });
      toast.success(`${variables.units.length} units imported successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to import units: ${error.message}`);
    },
  });
};

// Update scope item status
export const useUpdateScopeItemStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; project_id: string; status: "not_started" | "in_progress" | "complete" | "verified" }) => {
      const { id, project_id, ...updates } = data;
      const { error } = await supabase
        .from("unit_scope_items")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project_units", variables.project_id] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });
};
