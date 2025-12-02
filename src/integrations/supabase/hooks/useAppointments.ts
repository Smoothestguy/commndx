import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Appointment, AppointmentType, AppointmentStatus } from "@/types/roofing";

interface AppointmentInput {
  customer_id: string;
  project_id?: string;
  appointment_type: AppointmentType;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  assigned_to?: string;
  status?: AppointmentStatus;
  notes?: string;
}

export function useAppointments() {
  return useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          customer:customers(name, company, address),
          project:projects(name),
          assignee:profiles!appointments_assigned_to_fkey(first_name, last_name)
        `)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data as Appointment[];
    },
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: ["appointments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          customer:customers(name, company, address),
          project:projects(name),
          assignee:profiles!appointments_assigned_to_fkey(first_name, last_name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Appointment;
    },
    enabled: !!id,
  });
}

export function useAppointmentsByDateRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["appointments", "range", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          customer:customers(name, company, address),
          project:projects(name),
          assignee:profiles!appointments_assigned_to_fkey(first_name, last_name)
        `)
        .gte("start_time", startDate)
        .lte("start_time", endDate)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AppointmentInput) => {
      const { data, error } = await supabase
        .from("appointments")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create appointment: " + error.message);
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<AppointmentInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("appointments")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update appointment: " + error.message);
    },
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete appointment: " + error.message);
    },
  });
}
