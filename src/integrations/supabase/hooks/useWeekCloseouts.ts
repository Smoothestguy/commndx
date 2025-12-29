import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { toast } from "sonner";

export interface WeekCloseout {
  id: string;
  project_id: string | null;
  customer_id: string | null;
  week_start_date: string;
  week_end_date: string;
  status: string;
  closed_at: string | null;
  closed_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useWeekCloseout(projectId: string | undefined, weekStartDate: Date | undefined) {
  const weekStart = weekStartDate ? format(startOfWeek(weekStartDate, { weekStartsOn: 1 }), 'yyyy-MM-dd') : null;
  
  return useQuery({
    queryKey: ['week-closeout', projectId, weekStart],
    queryFn: async () => {
      if (!projectId || !weekStart) return null;
      
      const { data, error } = await supabase
        .from('time_week_closeouts')
        .select('*')
        .eq('project_id', projectId)
        .eq('week_start_date', weekStart)
        .maybeSingle();
      
      if (error) throw error;
      return data as WeekCloseout | null;
    },
    enabled: !!projectId && !!weekStart,
  });
}

export function useWeekCloseouts(weekStartDate: Date | undefined) {
  const weekStart = weekStartDate ? format(startOfWeek(weekStartDate, { weekStartsOn: 1 }), 'yyyy-MM-dd') : null;
  
  return useQuery({
    queryKey: ['week-closeouts', weekStart],
    queryFn: async () => {
      if (!weekStart) return [];
      
      const { data, error } = await supabase
        .from('time_week_closeouts')
        .select('*')
        .eq('week_start_date', weekStart);
      
      if (error) throw error;
      return data as WeekCloseout[];
    },
    enabled: !!weekStart,
  });
}

export function useCloseWeek() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      projectId,
      customerId,
      weekStartDate,
      notes,
    }: {
      projectId: string;
      customerId: string;
      weekStartDate: Date;
      notes?: string;
    }) => {
      const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 });
      
      const { data: user } = await supabase.auth.getUser();
      
      // First, snapshot hourly rates for any entries missing them
      // Get entries without hourly_rate and their personnel's current rates
      const { data: entriesWithoutRate, error: fetchError } = await supabase
        .from('time_entries')
        .select(`
          id,
          personnel_id,
          personnel:personnel_id (hourly_rate)
        `)
        .eq('project_id', projectId)
        .gte('entry_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('entry_date', format(weekEnd, 'yyyy-MM-dd'))
        .is('hourly_rate', null);
      
      if (fetchError) throw fetchError;
      
      // Update each entry with its personnel's current rate
      if (entriesWithoutRate && entriesWithoutRate.length > 0) {
        for (const entry of entriesWithoutRate) {
          const personnelRate = (entry.personnel as any)?.hourly_rate ?? 0;
          await supabase
            .from('time_entries')
            .update({ hourly_rate: personnelRate })
            .eq('id', entry.id);
        }
      }
      
      // Create closeout record
      const { data: closeout, error: closeoutError } = await supabase
        .from('time_week_closeouts')
        .insert({
          project_id: projectId,
          customer_id: customerId,
          week_start_date: format(weekStart, 'yyyy-MM-dd'),
          week_end_date: format(weekEnd, 'yyyy-MM-dd'),
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: user?.user?.id,
          notes,
        })
        .select()
        .single();
      
      if (closeoutError) throw closeoutError;
      
      // Lock all time entries for this project and week
      const { error: lockError } = await supabase
        .from('time_entries')
        .update({ 
          is_locked: true,
          week_closeout_id: closeout.id 
        })
        .eq('project_id', projectId)
        .gte('entry_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('entry_date', format(weekEnd, 'yyyy-MM-dd'));
      
      if (lockError) throw lockError;
      
      return closeout as WeekCloseout;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['week-closeout'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['all-time-entries'] });
      toast.success('Week closed successfully');
    },
    onError: (error) => {
      toast.error('Failed to close week: ' + error.message);
    },
  });
}

export function useReopenWeek() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (closeoutId: string) => {
      const { data: user } = await supabase.auth.getUser();
      
      // Unlock all time entries linked to this closeout
      const { error: unlockError } = await supabase
        .from('time_entries')
        .update({ 
          is_locked: false,
          week_closeout_id: null 
        })
        .eq('week_closeout_id', closeoutId);
      
      if (unlockError) throw unlockError;
      
      // Update the closeout status to reopened
      const { error: updateError } = await supabase
        .from('time_week_closeouts')
        .update({ 
          status: 'reopened',
          reopened_at: new Date().toISOString(),
          reopened_by: user?.user?.id,
        })
        .eq('id', closeoutId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['week-closeout'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['all-time-entries'] });
      toast.success('Week reopened successfully');
    },
    onError: (error) => {
      toast.error('Failed to reopen week: ' + error.message);
    },
  });
}
