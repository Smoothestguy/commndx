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
  lodging_type?: string | null;
  access_codes?: string | null;
  host_instructions?: string | null;
  notified_at?: string | null;
  notified_via?: string | null;
  location_id?: string | null;
}

export interface HotelAssignmentWithDetails extends HotelAssignment {
  personnel?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  project_locations?: { name: string } | null;
}

const HOTEL_SELECT = `*, personnel ( id, first_name, last_name ), project_locations:location_id ( name )`;

export function useLodgingByLocation(locationId: string | undefined) {
  return useQuery({
    queryKey: ["hotel-assignments", "by-location", locationId],
    enabled: !!locationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("personnel_hotel_assignments")
        .select(HOTEL_SELECT)
        .eq("location_id", locationId)
        .neq("status", "checked_out")
        .order("check_in", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HotelAssignmentWithDetails[];
    },
  });
}

export function useHotelAssignmentsByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["hotel-assignments", "by-project", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await (supabase as any)
        .from("personnel_hotel_assignments")
        .select(HOTEL_SELECT)
        .eq("project_id", projectId)
        .order("check_in", { ascending: false });

      if (error) throw error;
      return data as HotelAssignmentWithDetails[];
    },
    enabled: !!projectId,
  });
}

export interface CreateHotelAssignmentInput {
  personnelIds: string[];
  lodgingType?: string;
  accessCodes?: string;
  hostInstructions?: string;
  projectId: string;
  locationId?: string | null;
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

      const rows = input.personnelIds.map((pid) => ({
          personnel_id: pid,
          project_id: input.projectId,
          location_id: input.locationId || null,
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
          lodging_type: input.lodgingType || "hotel",
          access_codes: input.accessCodes || null,
          host_instructions: input.hostInstructions || null,
          created_by: user?.id || null,
        }));
      const { data, error } = await (supabase as any)
        .from("personnel_hotel_assignments")
        .insert(rows)
        .select("id");

      if (error) throw error;
      return (data ?? []).map((r: any) => r.id as string);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotel-assignments"] });
      toast.success("Lodging assigned");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create lodging assignment: ${error.message}`);
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
      toast.success("Lodging assignment updated");
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

export function useSendLodgingDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentIds: string[]) => {
      const { data, error } = await supabase.functions.invoke("send-lodging-details", { body: { assignment_ids: assignmentIds } });
      if (error) throw error;
      return data as { results: { assignment_id: string; sms: boolean; email: boolean; error?: string }[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["hotel-assignments"] });
      const ok = data?.results?.filter((r) => r.sms || r.email).length ?? 0;
      const total = data?.results?.length ?? 0;
      if (ok === total) toast.success(`Lodging details sent to ${ok}`);
      else toast.warning(`Sent ${ok} of ${total} — some had no valid phone/email`);
    },
    onError: (e: Error) => toast.error(`Failed to send: ${e.message}`),
  });
}
