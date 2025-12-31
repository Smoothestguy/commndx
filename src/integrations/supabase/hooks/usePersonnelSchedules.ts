import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PersonnelSchedule {
  id: string;
  personnel_id: string;
  project_id: string;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  personnel?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  project?: {
    id: string;
    name: string;
  };
}

export function usePersonnelSchedulesByProject(projectId: string | undefined, date?: string) {
  return useQuery({
    queryKey: ["personnel-schedules", "project", projectId, date],
    queryFn: async () => {
      if (!projectId) return [];

      let query = supabase
        .from("personnel_schedules")
        .select(`
          id,
          personnel_id,
          project_id,
          scheduled_date,
          scheduled_start_time,
          scheduled_end_time,
          notes,
          created_at,
          updated_at,
          personnel:personnel(id, first_name, last_name)
        `)
        .eq("project_id", projectId)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_start_time", { ascending: true });

      if (date) {
        query = query.eq("scheduled_date", date);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PersonnelSchedule[];
    },
    enabled: !!projectId,
  });
}

export function usePersonnelSchedulesByPersonnel(personnelId: string | undefined, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["personnel-schedules", "personnel", personnelId, startDate, endDate],
    queryFn: async () => {
      if (!personnelId) return [];

      let query = supabase
        .from("personnel_schedules")
        .select(`
          id,
          personnel_id,
          project_id,
          scheduled_date,
          scheduled_start_time,
          scheduled_end_time,
          notes,
          created_at,
          updated_at,
          project:projects(id, name)
        `)
        .eq("personnel_id", personnelId)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_start_time", { ascending: true });

      if (startDate) {
        query = query.gte("scheduled_date", startDate);
      }
      if (endDate) {
        query = query.lte("scheduled_date", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PersonnelSchedule[];
    },
    enabled: !!personnelId,
  });
}

export function useTodaysSchedule(personnelId: string | undefined) {
  const today = new Date().toISOString().split("T")[0];
  return usePersonnelSchedulesByPersonnel(personnelId, today, today);
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schedule: {
      personnel_id: string;
      project_id: string;
      scheduled_date: string;
      scheduled_start_time: string;
      scheduled_end_time?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("personnel_schedules")
        .insert([{
          ...schedule,
          created_by: user?.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-schedules"] });
      toast.success("Schedule created");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate key")) {
        toast.error("Schedule already exists for this date and project");
      } else {
        toast.error("Failed to create schedule: " + error.message);
      }
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      scheduled_start_time?: string;
      scheduled_end_time?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("personnel_schedules")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-schedules"] });
      toast.success("Schedule updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update schedule: " + error.message);
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("personnel_schedules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-schedules"] });
      toast.success("Schedule deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete schedule: " + error.message);
    },
  });
}
