import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface HotelAssignment {
  id: string;
  personnel_project_assignment_id: string | null;
  personnel_id: string;
  project_id: string;
  hotel_name: string;
  hotel_address: string | null;
  hotel_city: string | null;
  hotel_state: string | null;
  hotel_zip: string | null;
  hotel_phone: string | null;
  room_number: string | null;
  confirmation_number: string | null;
  check_in: string;
  check_out: string | null;
  nightly_rate: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface HotelAssignmentWithDetails extends HotelAssignment {
  personnel?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

export function useHotelAssignmentsByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["hotel-assignments", "by-project", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("personnel_hotel_assignments")
        .select(`
          *,
          personnel (
            id,
            first_name,
            last_name
          )
        `)
        .eq("project_id", projectId)
        .order("check_in", { ascending: false });

      if (error) throw error;
      return data as HotelAssignmentWithDetails[];
    },
    enabled: !!projectId,
  });
}

export interface CreateHotelAssignmentInput {
  personnelId: string;
  projectId: string;
  personnelProjectAssignmentId?: string;
  hotelName: string;
  hotelAddress?: string;
  hotelCity?: string;
  hotelState?: string;
  hotelZip?: string;
  hotelPhone?: string;
  roomNumber?: string;
  confirmationNumber?: string;
  checkIn: string;
  checkOut?: string;
  nightlyRate?: number;
  notes?: string;
}

export function useCreateHotelAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateHotelAssignmentInput) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("personnel_hotel_assignments")
        .insert({
          personnel_id: input.personnelId,
          project_id: input.projectId,
          personnel_project_assignment_id: input.personnelProjectAssignmentId || null,
          hotel_name: input.hotelName,
          hotel_address: input.hotelAddress || null,
          hotel_city: input.hotelCity || null,
          hotel_state: input.hotelState || null,
          hotel_zip: input.hotelZip || null,
          hotel_phone: input.hotelPhone || null,
          room_number: input.roomNumber || null,
          confirmation_number: input.confirmationNumber || null,
          check_in: input.checkIn,
          check_out: input.checkOut || null,
          nightly_rate: input.nightlyRate || null,
          notes: input.notes || null,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotel-assignments"] });
      toast.success("Hotel assignment created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create hotel assignment: ${error.message}`);
    },
  });
}

export function useUpdateHotelAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<HotelAssignment> }) => {
      const { data, error } = await supabase
        .from("personnel_hotel_assignments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotel-assignments"] });
      toast.success("Hotel assignment updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

export function useCheckOutHotel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("personnel_hotel_assignments")
        .update({ status: "checked_out", check_out: new Date().toISOString().split("T")[0] })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotel-assignments"] });
      toast.success("Checked out successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to check out: ${error.message}`);
    },
  });
}
