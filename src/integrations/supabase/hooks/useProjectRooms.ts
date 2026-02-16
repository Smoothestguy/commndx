import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProjectRoom {
  id: string;
  project_id: string;
  unit_number: string;
  floor_number: number | null;
  status: 'not_started' | 'in_progress' | 'complete' | 'verified';
  assigned_contractor_id: string | null;
  assigned_vendor_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  room_scope_items?: RoomScopeItem[];
  contractor?: { id: string; first_name: string; last_name: string } | null;
}

export interface RoomScopeItem {
  id: string;
  room_id: string;
  job_order_line_item_id: string;
  allocated_quantity: number;
  completed_quantity: number;
  unit: string | null;
  status: 'pending' | 'in_progress' | 'complete' | 'verified';
  created_at: string;
  updated_at: string;
  job_order_line_item?: {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    job_order_id: string;
  };
}

export interface RemainingQuantity {
  line_item_id: string;
  description: string;
  total_quantity: number;
  allocated_quantity: number;
  remaining_quantity: number;
  job_order_id: string;
  job_order_number?: string;
}

export function useProjectRooms(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-rooms", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data: rooms, error } = await supabase
        .from("project_rooms")
        .select(`
          *,
          contractor:personnel!project_rooms_assigned_contractor_id_fkey(id, first_name, last_name)
        `)
        .eq("project_id", projectId)
        .order("unit_number");

      if (error) throw error;

      // Fetch scope items for all rooms
      const roomIds = rooms.map((r: any) => r.id);
      if (roomIds.length === 0) return rooms;

      const { data: scopeItems, error: scopeError } = await supabase
        .from("room_scope_items")
        .select(`
          *,
          job_order_line_item:job_order_line_items!room_scope_items_job_order_line_item_id_fkey(
            id, description, quantity, unit_price, job_order_id
          )
        `)
        .in("room_id", roomIds);

      if (scopeError) throw scopeError;

      // Attach scope items to rooms
      return rooms.map((room: any) => ({
        ...room,
        room_scope_items: scopeItems?.filter((si: any) => si.room_id === room.id) || [],
      }));
    },
    enabled: !!projectId,
  });
}

export function useJobOrderRemainingQuantities(projectId: string | undefined) {
  return useQuery({
    queryKey: ["job-order-remaining-quantities", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      // Get all job orders for this project
      const { data: jobOrders, error: joError } = await supabase
        .from("job_orders")
        .select("id, number")
        .eq("project_id", projectId);

      if (joError) throw joError;
      if (!jobOrders || jobOrders.length === 0) return [];

      const joIds = jobOrders.map((jo: any) => jo.id);

      // Get all line items
      const { data: lineItems, error: liError } = await supabase
        .from("job_order_line_items")
        .select("id, description, quantity, unit_price, job_order_id")
        .in("job_order_id", joIds);

      if (liError) throw liError;
      if (!lineItems || lineItems.length === 0) return [];

      // Get all allocations
      const lineItemIds = lineItems.map((li: any) => li.id);
      const { data: allocations, error: allocError } = await supabase
        .from("room_scope_items")
        .select("job_order_line_item_id, allocated_quantity")
        .in("job_order_line_item_id", lineItemIds);

      if (allocError) throw allocError;

      // Build allocation map
      const allocationMap = new Map<string, number>();
      (allocations || []).forEach((a: any) => {
        const current = allocationMap.get(a.job_order_line_item_id) || 0;
        allocationMap.set(a.job_order_line_item_id, current + Number(a.allocated_quantity));
      });

      const joMap = new Map(jobOrders.map((jo: any) => [jo.id, jo.number]));

      return lineItems.map((li: any): RemainingQuantity => {
        const allocated = allocationMap.get(li.id) || 0;
        return {
          line_item_id: li.id,
          description: li.description,
          total_quantity: li.quantity,
          allocated_quantity: allocated,
          remaining_quantity: li.quantity - allocated,
          job_order_id: li.job_order_id,
          job_order_number: joMap.get(li.job_order_id) || '',
        };
      });
    },
    enabled: !!projectId,
  });
}

export function useAddRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      project_id: string;
      unit_number: string;
      floor_number?: number | null;
      assigned_contractor_id?: string | null;
      assigned_vendor_id?: string | null;
      notes?: string;
      scope_items: {
        job_order_line_item_id: string;
        allocated_quantity: number;
        unit?: string;
      }[];
    }) => {
      const { scope_items, ...roomData } = data;

      // Insert room
      const { data: room, error: roomError } = await supabase
        .from("project_rooms")
        .insert(roomData as any)
        .select()
        .single();

      if (roomError) throw roomError;

      // Insert scope items
      if (scope_items.length > 0) {
        const scopeRows = scope_items.map((si) => ({
          room_id: room.id,
          job_order_line_item_id: si.job_order_line_item_id,
          allocated_quantity: si.allocated_quantity,
          unit: si.unit || null,
        }));

        const { error: scopeError } = await supabase
          .from("room_scope_items")
          .insert(scopeRows as any);

        if (scopeError) throw scopeError;
      }

      return room;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-rooms", variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ["job-order-remaining-quantities", variables.project_id] });
      toast.success("Room added successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add room");
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      project_id: string;
      unit_number?: string;
      floor_number?: number | null;
      status?: 'not_started' | 'in_progress' | 'complete' | 'verified';
      assigned_contractor_id?: string | null;
      notes?: string | null;
    }) => {
      const { id, project_id, ...updates } = data;
      const { error } = await supabase
        .from("project_rooms")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-rooms", variables.project_id] });
      toast.success("Room updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update room");
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; project_id: string }) => {
      const { error } = await supabase
        .from("project_rooms")
        .delete()
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-rooms", variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ["job-order-remaining-quantities", variables.project_id] });
      toast.success("Room deleted");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete room");
    },
  });
}

export function useUpdateScopeItemProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      completed_quantity: number;
      status?: 'pending' | 'in_progress' | 'complete' | 'verified';
      project_id: string;
    }) => {
      const { id, project_id, ...updates } = data;
      const { error } = await supabase
        .from("room_scope_items")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-rooms", variables.project_id] });
      toast.success("Progress updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update progress");
    },
  });
}
