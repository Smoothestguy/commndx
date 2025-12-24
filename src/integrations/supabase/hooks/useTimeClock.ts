import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { GeoData } from "@/hooks/useGeolocation";

export interface ClockEntry {
  id: string;
  project_id: string;
  personnel_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_in_accuracy: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  clock_out_accuracy: number | null;
  entry_source: string;
  hours: number | null;
  project?: {
    id: string;
    name: string;
    time_clock_enabled: boolean;
    require_clock_location: boolean;
  };
}

// Get open clock entry for a specific personnel and project
export function useOpenClockEntry(personnelId: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ["open-clock-entry", personnelId, projectId],
    queryFn: async () => {
      if (!personnelId || !projectId) return null;

      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          id,
          project_id,
          personnel_id,
          clock_in_at,
          clock_out_at,
          clock_in_lat,
          clock_in_lng,
          clock_in_accuracy,
          clock_out_lat,
          clock_out_lng,
          clock_out_accuracy,
          entry_source,
          hours
        `)
        .eq("personnel_id", personnelId)
        .eq("project_id", projectId)
        .not("clock_in_at", "is", null)
        .is("clock_out_at", null)
        .maybeSingle();

      if (error) throw error;
      return data as ClockEntry | null;
    },
    enabled: !!personnelId && !!projectId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Get all open clock entries for a personnel (across all projects)
export function useAllOpenClockEntries(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["all-open-clock-entries", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];

      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          id,
          project_id,
          personnel_id,
          clock_in_at,
          clock_out_at,
          clock_in_lat,
          clock_in_lng,
          clock_in_accuracy,
          entry_source,
          hours,
          project:projects(id, name, time_clock_enabled, require_clock_location)
        `)
        .eq("personnel_id", personnelId)
        .not("clock_in_at", "is", null)
        .is("clock_out_at", null);

      if (error) throw error;
      return data as ClockEntry[];
    },
    enabled: !!personnelId,
    refetchInterval: 30000,
  });
}

// Get clock-enabled projects for a personnel
export function useClockEnabledProjects(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["clock-enabled-projects", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];

      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .select(`
          id,
          project:projects(
            id,
            name,
            status,
            time_clock_enabled,
            require_clock_location
          )
        `)
        .eq("personnel_id", personnelId)
        .eq("status", "active");

      if (error) throw error;

      // Filter to only clock-enabled projects
      return data
        .filter((a) => a.project?.time_clock_enabled === true)
        .map((a) => a.project!);
    },
    enabled: !!personnelId,
  });
}

// Clock in mutation
export function useClockIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      personnelId,
      geoData,
    }: {
      projectId: string;
      personnelId: string;
      geoData: GeoData;
    }) => {
      // Create a new time entry with clock-in data
      const now = new Date();
      const { data, error } = await supabase
        .from("time_entries")
        .insert([{
          project_id: projectId,
          personnel_id: personnelId,
          entry_date: now.toISOString().split("T")[0],
          clock_in_at: now.toISOString(),
          clock_in_lat: geoData.lat,
          clock_in_lng: geoData.lng,
          clock_in_accuracy: geoData.accuracy,
          entry_source: "clock",
          status: "pending",
          hours: 0,
          regular_hours: 0,
          overtime_hours: 0,
        } as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["open-clock-entry", variables.personnelId, variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-open-clock-entries", variables.personnelId] });
      queryClient.invalidateQueries({ queryKey: ["personnel-time-entries", variables.personnelId] });
      toast.success("Clocked in successfully");
    },
    onError: (error: Error) => {
      if (error.message.includes("idx_one_open_clock_per_personnel_project")) {
        toast.error("You already have an open clock entry for this project");
      } else {
        toast.error("Failed to clock in: " + error.message);
      }
    },
  });
}

// Clock out mutation
export function useClockOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      personnelId,
      projectId,
      clockInAt,
      geoData,
    }: {
      entryId: string;
      personnelId: string;
      projectId: string;
      clockInAt: string;
      geoData: GeoData;
    }) => {
      const now = new Date();
      const clockIn = new Date(clockInAt);
      
      // Calculate hours worked
      const hoursWorked = (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      const roundedHours = Math.round(hoursWorked * 100) / 100; // Round to 2 decimal places

      const { data, error } = await supabase
        .from("time_entries")
        .update({
          clock_out_at: now.toISOString(),
          clock_out_lat: geoData.lat,
          clock_out_lng: geoData.lng,
          clock_out_accuracy: geoData.accuracy,
          hours: roundedHours,
          regular_hours: roundedHours, // Overtime will be calculated at weekly level
        })
        .eq("id", entryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["open-clock-entry", variables.personnelId, variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-open-clock-entries", variables.personnelId] });
      queryClient.invalidateQueries({ queryKey: ["personnel-time-entries", variables.personnelId] });
      toast.success("Clocked out successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to clock out: " + error.message);
    },
  });
}

// Helper to format time in 24h format
export function formatTime24h(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Helper to format date and time
export function formatDateTime24h(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  }) + " at " + formatTime24h(dateString);
}
