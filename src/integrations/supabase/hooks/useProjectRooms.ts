import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProjectRoom {
  id: string;
  project_id: string;
  unit_number: string;
  floor_number: number | null;
  shower_size: string | null;
  ceiling_height: number | null;
  status: 'not_started' | 'in_progress' | 'complete' | 'verified';
  assigned_contractor_id: string | null;
  assigned_vendor_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  room_scope_items?: RoomScopeItem[];
}

export interface RoomScopeItem {
  id: string;
  room_id: string;
  job_order_line_item_id: string;
  scope_code: string | null;
  scope_description: string | null;
  allocated_quantity: number;
  completed_quantity: number;
  unit: string | null;
  status: 'pending' | 'in_progress' | 'complete' | 'verified';
  created_at: string;
  updated_at: string;
}

export interface RoomScopeSummaryItem {
  job_order_line_item_id: string;
  description: string;
  total_quantity: number;
  allocated_quantity: number;
  remaining_quantity: number;
}

export function useProjectRooms(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-rooms', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_rooms')
        .select('*, room_scope_items(*)')
        .eq('project_id', projectId)
        .order('unit_number', { ascending: true });
      if (error) throw error;
      return data as ProjectRoom[];
    },
    enabled: !!projectId,
  });
}

export function useRoomScopeSummary(projectId: string | undefined) {
  return useQuery({
    queryKey: ['room-scope-summary', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      // Get all JO line items for this project
      const { data: jobOrders, error: joError } = await supabase
        .from('job_orders')
        .select('id')
        .eq('project_id', projectId);
      if (joError) throw joError;
      if (!jobOrders || jobOrders.length === 0) return [];

      const joIds = jobOrders.map(jo => jo.id);
      const { data: lineItems, error: liError } = await supabase
        .from('job_order_line_items')
        .select('id, description, quantity, product_name')
        .in('job_order_id', joIds);
      if (liError) throw liError;
      if (!lineItems) return [];

      // Get all scope allocations for rooms in this project
      const { data: rooms, error: roomError } = await supabase
        .from('project_rooms')
        .select('id')
        .eq('project_id', projectId);
      if (roomError) throw roomError;

      let allocations: Record<string, number> = {};
      if (rooms && rooms.length > 0) {
        const roomIds = rooms.map(r => r.id);
        const { data: scopeItems, error: siError } = await supabase
          .from('room_scope_items')
          .select('job_order_line_item_id, allocated_quantity')
          .in('room_id', roomIds);
        if (siError) throw siError;
        if (scopeItems) {
          for (const si of scopeItems) {
            allocations[si.job_order_line_item_id] = 
              (allocations[si.job_order_line_item_id] || 0) + Number(si.allocated_quantity);
          }
        }
      }

      return lineItems.map(li => ({
        job_order_line_item_id: li.id,
        description: li.product_name || li.description,
        total_quantity: Number(li.quantity),
        allocated_quantity: allocations[li.id] || 0,
        remaining_quantity: Number(li.quantity) - (allocations[li.id] || 0),
      })) as RoomScopeSummaryItem[];
    },
    enabled: !!projectId,
  });
}

export function useAddRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (room: {
      project_id: string;
      unit_number: string;
      floor_number?: number;
      shower_size?: string;
      ceiling_height?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('project_rooms')
        .insert(room)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-rooms', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['room-scope-summary', data.project_id] });
      toast.success('Room added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useBulkImportRooms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, rooms }: {
      projectId: string;
      rooms: Array<{
        unit_number: string;
        floor_number?: number;
        shower_size?: string;
        ceiling_height?: number;
        notes?: string;
        scope_items: Array<{
          job_order_line_item_id: string;
          scope_code?: string;
          scope_description?: string;
          allocated_quantity: number;
          unit?: string;
        }>;
      }>;
    }) => {
      const results = [];
      for (const room of rooms) {
        const { data: roomData, error: roomError } = await supabase
          .from('project_rooms')
          .insert({
            project_id: projectId,
            unit_number: room.unit_number,
            floor_number: room.floor_number,
            shower_size: room.shower_size,
            ceiling_height: room.ceiling_height,
            notes: room.notes,
          })
          .select()
          .single();
        if (roomError) throw new Error(`Room ${room.unit_number}: ${roomError.message}`);

        if (room.scope_items.length > 0) {
          const scopeInserts = room.scope_items
            .filter(si => si.allocated_quantity > 0)
            .map(si => ({
              room_id: roomData.id,
              job_order_line_item_id: si.job_order_line_item_id,
              scope_code: si.scope_code || null,
              scope_description: si.scope_description || null,
              allocated_quantity: si.allocated_quantity,
              unit: si.unit || null,
            }));
          if (scopeInserts.length > 0) {
            const { error: scopeError } = await supabase
              .from('room_scope_items')
              .insert(scopeInserts);
            if (scopeError) throw new Error(`Room ${room.unit_number} scope items: ${scopeError.message}`);
          }
        }
        results.push(roomData);
      }
      return { projectId, count: results.length };
    },
    onSuccess: ({ projectId, count }) => {
      queryClient.invalidateQueries({ queryKey: ['project-rooms', projectId] });
      queryClient.invalidateQueries({ queryKey: ['room-scope-summary', projectId] });
      toast.success(`${count} rooms imported successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProjectRoom> & { id: string }) => {
      const { data, error } = await supabase
        .from('project_rooms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-rooms', data.project_id] });
      toast.success('Room updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      // Delete scope items first
      const { error: scopeError } = await supabase
        .from('room_scope_items')
        .delete()
        .eq('room_id', id);
      if (scopeError) throw scopeError;

      const { error } = await supabase
        .from('project_rooms')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['project-rooms', projectId] });
      queryClient.invalidateQueries({ queryKey: ['room-scope-summary', projectId] });
      toast.success('Room deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
