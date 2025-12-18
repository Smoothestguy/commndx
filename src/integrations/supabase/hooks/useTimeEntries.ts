import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOfWeek, endOfWeek } from "date-fns";
import { useMyProjectAssignments } from "./useProjectAssignments";

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  personnel_id?: string | null;
  entry_date: string;
  hours: number;
  regular_hours?: number | null;
  overtime_hours?: number | null;
  is_holiday?: boolean | null;
  description?: string | null;
  billable: boolean;
  status?: string;
  created_at: string;
  updated_at: string;
}

export interface TimeEntryWithDetails extends TimeEntry {
  personnel_id?: string | null;
  invoice_id?: string | null;
  invoiced_at?: string | null;
  vendor_bill_id?: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    hourly_rate: number | null;
  } | null;
  personnel?: {
    first_name: string;
    last_name: string;
    hourly_rate: number | null;
    photo_url: string | null;
    everify_status: string | null;
    everify_expiry: string | null;
    work_auth_expiry: string | null;
    i9_completed_at: string | null;
  } | null;
  projects?: {
    name: string;
    customer_id?: string | null;
    customers?: {
      name: string;
    } | null;
  } | null;
}

export interface TimeEntryInsert {
  project_id: string;
  entry_date: string;
  hours: number;
  regular_hours?: number;
  overtime_hours?: number;
  is_holiday?: boolean;
  description?: string | null;
  billable?: boolean;
}

// Calculate regular and overtime hours based on daily threshold
export function calculateOvertimeHours(totalHours: number, dailyThreshold: number = 8) {
  const regularHours = Math.min(totalHours, dailyThreshold);
  const overtimeHours = Math.max(0, totalHours - dailyThreshold);
  return { regularHours, overtimeHours };
}

// Get existing daily hours for overtime calculation
export function useExistingDailyHours(date: string, excludeEntryId?: string) {
  return useQuery({
    queryKey: ["time-entries", "daily-total", date, excludeEntryId],
    queryFn: async () => {
      if (!date) return 0;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("time_entries")
        .select("hours")
        .eq("user_id", user.id)
        .eq("entry_date", date);
      
      if (excludeEntryId) {
        query = query.neq("id", excludeEntryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data?.reduce((sum, e) => sum + Number(e.hours), 0) || 0;
    },
    enabled: !!date,
  });
}

// Get assigned projects for current user
export function useAssignedProjects() {
  const { data: assignments = [] } = useMyProjectAssignments();
  
  return useQuery({
    queryKey: ["assigned-projects", assignments.map(a => a.project_id)],
    queryFn: async () => {
      if (assignments.length === 0) return [];

      const projectIds = assignments.map(a => a.project_id);
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .in("id", projectIds);

      if (error) throw error;
      return data;
    },
    enabled: assignments.length > 0,
  });
}

// Fetch all time entries for current user
export const useTimeEntries = () => {
  return useQuery({
    queryKey: ["time-entries"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: false });

      if (error) throw error;
      return data as TimeEntry[];
    },
  });
};

// Fetch time entries for a specific date
export const useTimeEntriesByDate = (date: string) => {
  return useQuery({
    queryKey: ["time-entries", "date", date],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("entry_date", date)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TimeEntry[];
    },
  });
};

// Fetch time entries for a specific week
export const useTimeEntriesByWeek = (weekStartDate: Date) => {
  const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 });

  return useQuery({
    queryKey: ["time-entries", "week", weekStart.toISOString()],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("entry_date", weekStart.toISOString().split("T")[0])
        .lte("entry_date", weekEnd.toISOString().split("T")[0])
        .order("entry_date", { ascending: true });

      if (error) throw error;
      return data as TimeEntry[];
    },
  });
};

// Fetch all time entries logged by current user for a specific week (includes personnel entries)
export const useAdminTimeEntriesByWeek = (weekStartDate: Date) => {
  const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 });

  return useQuery({
    queryKey: ["admin-time-entries", "week", weekStart.toISOString()],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          personnel:personnel_id(id, first_name, last_name, hourly_rate, photo_url),
          projects:project_id(id, name)
        `)
        .eq("user_id", user.id)
        .gte("entry_date", weekStart.toISOString().split("T")[0])
        .lte("entry_date", weekEnd.toISOString().split("T")[0])
        .order("entry_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
};

// Update time entry status (approve/reject)
export const useUpdateTimeEntryStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { data, error } = await supabase
        .from("time_entries")
        .update({ status })
        .in("id", ids)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["all-time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["admin-time-entries"] });
      toast.success(`Time entries ${status === 'approved' ? 'approved' : 'updated'}`);
    },
    onError: () => {
      toast.error("Failed to update time entry status");
    },
  });
};

// Fetch personnel time entries for a specific project and week
export const usePersonnelTimeEntriesByWeek = (projectId: string, weekStartDate: Date) => {
  const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 });

  return useQuery({
    queryKey: ["personnel-time-entries", projectId, weekStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("project_id", projectId)
        .not("personnel_id", "is", null)
        .gte("entry_date", weekStart.toISOString().split("T")[0])
        .lte("entry_date", weekEnd.toISOString().split("T")[0])
        .order("entry_date", { ascending: true });

      if (error) throw error;
      return data as TimeEntry[];
    },
    enabled: !!projectId,
  });
};

// Add or update a time entry (upsert to handle duplicates)
export const useAddTimeEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: TimeEntryInsert) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Store full hours - overtime is calculated at weekly aggregation time
      const { data, error } = await supabase
        .from("time_entries")
        .upsert(
          { 
            ...entry, 
            user_id: user.id,
            regular_hours: entry.hours,
            overtime_hours: 0,
          },
          { onConflict: 'user_id,project_id,entry_date' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Time entry saved successfully");
    },
    onError: () => {
      toast.error("Failed to save time entry");
    },
  });
};

// Update an existing time entry
export const useUpdateTimeEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TimeEntry> & { id: string }) => {
      // Store full hours - overtime is calculated at weekly aggregation time
      if (updates.hours !== undefined) {
        updates.regular_hours = updates.hours;
        updates.overtime_hours = 0;
      }

      const { data, error } = await supabase
        .from("time_entries")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Time entry updated successfully");
    },
    onError: () => {
      toast.error("Failed to update time entry");
    },
  });
};

// Delete a time entry
export const useDeleteTimeEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("time_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Time entry deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete time entry");
    },
  });
};

// Bulk delete time entries
export const useBulkDeleteTimeEntries = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) throw new Error("No entries to delete");

      const { error } = await supabase
        .from("time_entries")
        .delete()
        .in("id", ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["all-time-entries"] });
      toast.success(`${count} time ${count === 1 ? 'entry' : 'entries'} deleted`);
    },
    onError: () => {
      toast.error("Failed to delete time entries");
    },
  });
};

// Fetch all time entries with details (for admin/manager view)
export const useAllTimeEntries = (projectFilter?: string, personnelFilter?: string) => {
  return useQuery({
    queryKey: ["all-time-entries", projectFilter, personnelFilter],
    queryFn: async () => {
      let query = supabase
        .from("time_entries")
        .select(`
          *,
          profiles:user_id(first_name, last_name, email, hourly_rate),
          personnel:personnel_id(first_name, last_name, hourly_rate, pay_rate, bill_rate, photo_url, everify_status, everify_expiry, work_auth_expiry, i9_completed_at),
          projects:project_id(
            name,
            customer_id,
            customers:customer_id(name)
          )
        `)
        .order("entry_date", { ascending: false });

      if (projectFilter) {
        query = query.eq("project_id", projectFilter);
      }

      if (personnelFilter) {
        query = query.eq("user_id", personnelFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as TimeEntryWithDetails[];
    },
  });
};

// Bulk add/update time entries (for weekly entry)
export const useBulkAddTimeEntries = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entries: TimeEntryInsert[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Filter out entries with 0 or no hours - overtime calculated at weekly aggregation
      const validEntries = entries
        .filter(e => e.hours && e.hours > 0)
        .map(entry => ({ 
          ...entry, 
          user_id: user.id,
          regular_hours: entry.hours,
          overtime_hours: 0,
        }));

      if (validEntries.length === 0) {
        throw new Error("No valid entries to save");
      }

      // Use upsert to update existing entries or insert new ones
      const { data, error } = await supabase
        .from("time_entries")
        .upsert(validEntries, { 
          onConflict: 'user_id,project_id,entry_date',
          ignoreDuplicates: false 
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["all-time-entries"] });
      toast.success(`${data.length} time entries saved successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save time entries");
    },
  });
};

// Bulk add time entries for personnel (admin/manager use)
export interface PersonnelTimeEntryInsert {
  personnel_id: string;
  project_id: string;
  entry_date: string;
  hours: number;
  regular_hours?: number;
  overtime_hours?: number;
  is_holiday?: boolean;
  description?: string | null;
}

export const useBulkAddPersonnelTimeEntries = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entries: PersonnelTimeEntryInsert[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Filter out entries with 0 or no hours - overtime calculated at weekly aggregation
      const validEntries = entries
        .filter(e => e.hours && e.hours > 0)
        .map(entry => ({ 
          ...entry, 
          user_id: user.id, // The user who logged this entry
          billable: true,
          regular_hours: entry.hours,
          overtime_hours: 0,
        }));

      if (validEntries.length === 0) {
        throw new Error("No valid entries to save");
      }

      // Use upsert to update existing entries or insert new ones
      // Personnel entries use personnel_id as the conflict target
      const { data, error } = await supabase
        .from("time_entries")
        .upsert(validEntries, { 
          onConflict: 'personnel_id,project_id,entry_date',
          ignoreDuplicates: false 
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["all-time-entries"] });
      toast.success(`Time entries saved for ${data.length} personnel`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save time entries");
    },
  });
};
