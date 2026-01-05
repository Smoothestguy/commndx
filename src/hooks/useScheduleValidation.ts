import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduleValidationResult {
  hasSchedule: boolean;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  canClockIn: boolean;
  minutesLate: number;
  isBeforeSchedule: boolean;
}

/**
 * Hook to validate if personnel can clock in based on their schedule.
 * Returns whether they have a schedule and if they're within the 10-minute window.
 */
export function useScheduleValidation(personnelId: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ["schedule-validation", personnelId, projectId],
    queryFn: async (): Promise<ScheduleValidationResult> => {
      if (!personnelId || !projectId) {
        return {
          hasSchedule: false,
          scheduledStartTime: null,
          scheduledEndTime: null,
          canClockIn: true,
          minutesLate: 0,
          isBeforeSchedule: false,
        };
      }

      const today = new Date().toISOString().split("T")[0];
      
      const { data: schedule, error } = await supabase
        .from("personnel_schedules")
        .select("scheduled_start_time, scheduled_end_time")
        .eq("personnel_id", personnelId)
        .eq("project_id", projectId)
        .eq("scheduled_date", today)
        .maybeSingle();

      if (error) {
        console.error("Error fetching schedule:", error);
        // If there's an error, allow clock-in (fail open for schedule check)
        return {
          hasSchedule: false,
          scheduledStartTime: null,
          scheduledEndTime: null,
          canClockIn: true,
          minutesLate: 0,
          isBeforeSchedule: false,
        };
      }

      if (!schedule || !schedule.scheduled_start_time) {
        // No schedule for today - allow clock-in
        return {
          hasSchedule: false,
          scheduledStartTime: null,
          scheduledEndTime: null,
          canClockIn: true,
          minutesLate: 0,
          isBeforeSchedule: false,
        };
      }

      const now = new Date();
      // Parse the scheduled start time (format: "HH:MM:SS" or "HH:MM")
      const [hours, minutes] = schedule.scheduled_start_time.split(":").map(Number);
      const scheduledTime = new Date(now);
      scheduledTime.setHours(hours, minutes, 0, 0);

      const diffMs = now.getTime() - scheduledTime.getTime();
      const minutesLate = diffMs / (1000 * 60);

      // Can clock in if:
      // - Before the scheduled time (early is fine)
      // - Within 10 minutes after the scheduled time
      const canClockIn = minutesLate <= 10;
      const isBeforeSchedule = minutesLate < 0;

      return {
        hasSchedule: true,
        scheduledStartTime: schedule.scheduled_start_time,
        scheduledEndTime: schedule.scheduled_end_time,
        canClockIn,
        minutesLate: Math.max(0, minutesLate),
        isBeforeSchedule,
      };
    },
    enabled: !!personnelId && !!projectId,
    // Refetch periodically to keep timing accurate
    refetchInterval: 30000,
  });
}
