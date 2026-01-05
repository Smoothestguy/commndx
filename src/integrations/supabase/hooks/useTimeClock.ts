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
  lunch_start_at: string | null;
  lunch_end_at: string | null;
  lunch_duration_minutes: number | null;
  is_on_lunch: boolean;
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
          hours,
          lunch_start_at,
          lunch_end_at,
          lunch_duration_minutes,
          is_on_lunch
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
          lunch_start_at,
          lunch_end_at,
          lunch_duration_minutes,
          is_on_lunch,
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

// Get clock history for a personnel
export function useClockHistory(personnelId: string | undefined, days: number = 14) {
  return useQuery({
    queryKey: ["clock-history", personnelId, days],
    queryFn: async () => {
      if (!personnelId) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          id,
          project_id,
          personnel_id,
          entry_date,
          clock_in_at,
          clock_out_at,
          hours,
          lunch_start_at,
          lunch_end_at,
          lunch_duration_minutes,
          is_on_lunch,
          project:projects(id, name)
        `)
        .eq("personnel_id", personnelId)
        .eq("entry_source", "clock")
        .gte("entry_date", startDate.toISOString().split("T")[0])
        .order("clock_in_at", { ascending: false });

      if (error) throw error;
      return data;
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
      skipScheduleCheck,
    }: {
      projectId: string;
      personnelId: string;
      geoData: GeoData;
      skipScheduleCheck?: boolean;
    }) => {
      // Get the authenticated user's ID for RLS
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check schedule for late clock-in (unless explicitly skipped)
      if (!skipScheduleCheck) {
        const today = new Date().toISOString().split("T")[0];
        const now = new Date();
        
        const { data: schedule } = await supabase
          .from("personnel_schedules")
          .select("scheduled_start_time")
          .eq("personnel_id", personnelId)
          .eq("project_id", projectId)
          .eq("scheduled_date", today)
          .maybeSingle();

        if (schedule?.scheduled_start_time) {
          const [hours, minutes] = schedule.scheduled_start_time.split(":").map(Number);
          const scheduledTime = new Date(now);
          scheduledTime.setHours(hours, minutes, 0, 0);
          
          const diffMs = now.getTime() - scheduledTime.getTime();
          const minutesLate = diffMs / (1000 * 60);
          
          if (minutesLate > 10) {
            // Notify supervisors about the late attempt
            const attemptTime = now.toLocaleTimeString("en-US", { 
              hour: "2-digit", 
              minute: "2-digit",
              hour12: true 
            });
            
            // Fire and forget - don't block on this
            supabase.functions.invoke("notify-late-clock-attempt", {
              body: {
                personnel_id: personnelId,
                project_id: projectId,
                scheduled_start_time: schedule.scheduled_start_time,
                attempt_time: attemptTime,
                minutes_late: minutesLate,
              },
            }).catch(err => console.error("Failed to notify late clock attempt:", err));
            
            throw new Error(`LATE_CLOCK_IN_BLOCKED:${Math.round(minutesLate)}:${schedule.scheduled_start_time}`);
          }
        }
      }

      // Create a new time entry with clock-in data
      const now = new Date();
      const { data, error } = await supabase
        .from("time_entries")
        .insert([{
          project_id: projectId,
          personnel_id: personnelId,
          user_id: user.id,
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
          is_on_lunch: false,
          lunch_duration_minutes: 0,
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
      queryClient.invalidateQueries({ queryKey: ["clock-history", variables.personnelId] });
      toast.success("Clocked in successfully");
    },
    onError: (error: Error) => {
      // Don't show toast for late block - it's handled by the UI
      if (error.message.startsWith("LATE_CLOCK_IN_BLOCKED:")) {
        return;
      }
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
      lunchDurationMinutes,
      geoData,
    }: {
      entryId: string;
      personnelId: string;
      projectId: string;
      clockInAt: string;
      lunchDurationMinutes?: number;
      geoData: GeoData;
    }) => {
      const now = new Date();
      const clockIn = new Date(clockInAt);
      
      // Calculate hours worked with high precision (subtract lunch duration)
      const totalMs = now.getTime() - clockIn.getTime();
      const lunchMs = (lunchDurationMinutes || 0) * 60 * 1000;
      const workMs = totalMs - lunchMs;
      const hoursWorked = workMs / (1000 * 60 * 60);
      // Round to 4 decimal places for sub-second precision
      const preciseHours = Math.round(hoursWorked * 10000) / 10000;

      const { data, error } = await supabase
        .from("time_entries")
        .update({
          clock_out_at: now.toISOString(),
          clock_out_lat: geoData.lat,
          clock_out_lng: geoData.lng,
          clock_out_accuracy: geoData.accuracy,
          hours: preciseHours,
          regular_hours: preciseHours, // Overtime will be calculated at weekly level
          is_on_lunch: false,
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
      queryClient.invalidateQueries({ queryKey: ["clock-history", variables.personnelId] });
      toast.success("Clocked out successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to clock out: " + error.message);
    },
  });
}

// Start lunch mutation
export function useStartLunch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      personnelId,
      projectId,
    }: {
      entryId: string;
      personnelId: string;
      projectId: string;
    }) => {
      const now = new Date();

      const { data, error } = await supabase
        .from("time_entries")
        .update({
          lunch_start_at: now.toISOString(),
          is_on_lunch: true,
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
      toast.success("Lunch break started");
    },
    onError: (error: Error) => {
      toast.error("Failed to start lunch: " + error.message);
    },
  });
}

// End lunch mutation
export function useEndLunch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      personnelId,
      projectId,
      lunchStartAt,
    }: {
      entryId: string;
      personnelId: string;
      projectId: string;
      lunchStartAt: string;
    }) => {
      const now = new Date();
      const lunchStart = new Date(lunchStartAt);
      
      // Calculate lunch duration in minutes
      const lunchMinutes = Math.round((now.getTime() - lunchStart.getTime()) / (1000 * 60));

      const { data, error } = await supabase
        .from("time_entries")
        .update({
          lunch_end_at: now.toISOString(),
          lunch_duration_minutes: lunchMinutes,
          is_on_lunch: false,
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
      toast.success("Lunch break ended - back to work!");
    },
    onError: (error: Error) => {
      toast.error("Failed to end lunch: " + error.message);
    },
  });
}

// Helper to format time in 24h format with seconds
export function formatTime24h(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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

// Helper to format duration in hours, minutes, and seconds
export function formatDuration(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  if (hours === 0 && mins === 0) return `${secs}s`;
  if (hours === 0) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  if (mins === 0 && secs === 0) return `${hours}h`;
  if (secs === 0) return `${hours}h ${mins}m`;
  return `${hours}h ${mins}m ${secs}s`;
}

// Helper to format hours (decimal) to hours, minutes, seconds
export function formatHoursDetailed(hours: number): string {
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  if (h === 0 && m === 0) return `${s}s`;
  if (h === 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  if (m === 0 && s === 0) return `${h}h`;
  if (s === 0) return `${h}h ${m}m`;
  return `${h}h ${m}m ${s}s`;
}
