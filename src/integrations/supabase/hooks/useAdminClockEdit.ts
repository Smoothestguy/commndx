import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { useAuditLog } from "@/hooks/useAuditLog";
import type { Json } from "../types";

export interface TimeEntryForAdmin {
  id: string;
  personnel_id: string;
  project_id: string;
  entry_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_in_accuracy: number | null;
  hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  lunch_duration_minutes: number | null;
  entry_source: string | null;
  personnel: {
    first_name: string;
    last_name: string;
    personnel_number: string | null;
  } | null;
  project: {
    name: string;
  } | null;
}

interface UpdateClockInParams {
  entryId: string;
  newClockInAt: string;
  originalEntry: TimeEntryForAdmin;
}

export const useAdminTimeEntries = (
  startDate: string,
  endDate: string,
  personnelId?: string
) => {
  return useQuery({
    queryKey: ["admin-time-entries", startDate, endDate, personnelId],
    queryFn: async () => {
      let query = supabase
        .from("time_entries")
        .select(`
          id,
          personnel_id,
          project_id,
          entry_date,
          clock_in_at,
          clock_out_at,
          clock_in_lat,
          clock_in_lng,
          clock_in_accuracy,
          hours,
          regular_hours,
          overtime_hours,
          lunch_duration_minutes,
          entry_source,
          personnel:personnel_id (
            first_name,
            last_name,
            personnel_number
          ),
          project:project_id (
            name
          )
        `)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate)
        .not("clock_in_at", "is", null)
        .order("clock_in_at", { ascending: false });

      if (personnelId) {
        query = query.eq("personnel_id", personnelId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as TimeEntryForAdmin[];
    },
    enabled: !!startDate && !!endDate,
  });
};

export const useUpdateClockIn = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async ({ entryId, newClockInAt, originalEntry }: UpdateClockInParams) => {
      // Calculate new hours if clocked out
      let newHours = originalEntry.hours;
      let newRegularHours = originalEntry.regular_hours;
      let newOvertimeHours = originalEntry.overtime_hours;

      if (originalEntry.clock_out_at) {
        const clockIn = new Date(newClockInAt);
        const clockOut = new Date(originalEntry.clock_out_at);
        const totalMs = clockOut.getTime() - clockIn.getTime();
        const lunchMs = (originalEntry.lunch_duration_minutes || 0) * 60 * 1000;
        const workMs = Math.max(0, totalMs - lunchMs);
        newHours = Math.round((workMs / (1000 * 60 * 60)) * 100) / 100;
        
        // Recalculate overtime (8 hours threshold)
        if (newHours > 8) {
          newRegularHours = 8;
          newOvertimeHours = Math.round((newHours - 8) * 100) / 100;
        } else {
          newRegularHours = newHours;
          newOvertimeHours = 0;
        }
      }

      const { data, error } = await supabase
        .from("time_entries")
        .update({
          clock_in_at: newClockInAt,
          hours: newHours,
          regular_hours: newRegularHours,
          overtime_hours: newOvertimeHours,
          entry_source: "admin_edit",
        })
        .eq("id", entryId)
        .select()
        .single();

      if (error) throw error;

      // Log the change
      await logAction({
        actionType: "update",
        resourceType: "time_entry",
        resourceId: entryId,
        changesBefore: {
          clock_in_at: originalEntry.clock_in_at,
          hours: originalEntry.hours,
          regular_hours: originalEntry.regular_hours,
          overtime_hours: originalEntry.overtime_hours,
          entry_source: originalEntry.entry_source,
        } as Json,
        changesAfter: {
          clock_in_at: newClockInAt,
          hours: newHours,
          regular_hours: newRegularHours,
          overtime_hours: newOvertimeHours,
          entry_source: "admin_edit",
        } as Json,
        metadata: {
          edit_type: "clock_in_adjustment",
          personnel_id: originalEntry.personnel_id,
          project_id: originalEntry.project_id,
        } as Json,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["clock-history"] });
    },
  });
};

export const usePersonnelList = () => {
  return useQuery({
    queryKey: ["personnel-list-for-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, first_name, last_name, personnel_number")
        .eq("status", "active")
        .order("first_name", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
};
