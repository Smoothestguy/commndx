import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { toast } from "sonner";
import { calculateSingleEmployeeOvertime } from "@/lib/overtimeUtils";

// Hook to calculate labor costs directly from time entries for a project
export function useProjectTimeEntryCosts(projectId: string | undefined, overtimeMultiplier: number = 1.5, holidayMultiplier: number = 2.0) {
  return useQuery({
    queryKey: ['project-time-entry-costs', projectId, overtimeMultiplier, holidayMultiplier],
    queryFn: async () => {
      if (!projectId) return { totalLaborCost: 0, totalHours: 0, regularHours: 0, overtimeHours: 0, holidayHours: 0 };
      
      // Get all time entries for this project with personnel hourly rate
      const { data: entries, error } = await supabase
        .from('time_entries')
        .select(`
          hours,
          regular_hours,
          overtime_hours,
          hourly_rate,
          is_holiday,
          personnel:personnel_id (hourly_rate)
        `)
        .eq('project_id', projectId);
      
      if (error) throw error;
      
      let totalLaborCost = 0;
      let totalHours = 0;
      let regularHours = 0;
      let overtimeHours = 0;
      let holidayHours = 0;
      
      for (const entry of entries || []) {
        // Use snapshotted rate from entry, fallback to personnel's current rate
        const rate = entry.hourly_rate || (entry.personnel as any)?.hourly_rate || 0;
        const entryHours = entry.hours || 0;
        const isHoliday = (entry as any).is_holiday === true;
        
        totalHours += entryHours;
        
        if (isHoliday) {
          // Holiday hours are paid at full holiday multiplier (2x)
          holidayHours += entryHours;
          totalLaborCost += entryHours * rate * holidayMultiplier;
        } else {
          // Non-holiday: use regular/overtime split if available
          const regHrs = entry.regular_hours || entryHours;
          const otHrs = entry.overtime_hours || 0;
          
          regularHours += regHrs;
          overtimeHours += otHrs;
          
          totalLaborCost += (regHrs * rate) + (otHrs * rate * overtimeMultiplier);
        }
      }
      
      return { totalLaborCost, totalHours, regularHours, overtimeHours, holidayHours };
    },
    enabled: !!projectId,
  });
}
export interface ProjectLaborExpense {
  id: string;
  project_id: string;
  customer_id: string;
  week_closeout_id: string | null;
  personnel_id: string;
  personnel_name: string;
  week_start_date: string;
  week_end_date: string;
  regular_hours: number;
  overtime_hours: number;
  hourly_rate: number;
  overtime_rate: number;
  total_amount: number;
  status: string;
  billable: boolean | null;
  invoice_id: string | null;
  invoice_line_item_id: string | null;
  personnel_payment_id: string | null;
  created_at: string | null;
}

export interface PersonnelWeeklySummary {
  personnel_id: string;
  personnel_name: string;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  holiday_hours: number;
  hourly_rate: number;
  regular_amount: number;
  overtime_amount: number;
  holiday_amount: number;
  total_amount: number;
}

export function useProjectLaborExpenses(projectId: string | undefined, weekStartDate: Date | undefined) {
  const weekStart = weekStartDate ? format(startOfWeek(weekStartDate, { weekStartsOn: 1 }), 'yyyy-MM-dd') : null;
  
  return useQuery({
    queryKey: ['project-labor-expenses', projectId, weekStart],
    queryFn: async () => {
      if (!projectId || !weekStart) return [];
      
      const { data, error } = await supabase
        .from('project_labor_expenses')
        .select(`
          *,
          personnel:personnel_id (
            id,
            first_name,
            last_name,
            hourly_rate
          )
        `)
        .eq('project_id', projectId)
        .eq('week_start_date', weekStart);
      
      if (error) throw error;
      return data as ProjectLaborExpense[];
    },
    enabled: !!projectId && !!weekStart,
  });
}

export function useWeeklyPersonnelSummary(projectId: string | undefined, weekStartDate: Date | undefined, holidayMultiplier: number = 2.0) {
  const weekStart = weekStartDate ? startOfWeek(weekStartDate, { weekStartsOn: 1 }) : null;
  const weekEnd = weekStart ? endOfWeek(weekStartDate!, { weekStartsOn: 1 }) : null;
  
  return useQuery({
    queryKey: ['weekly-personnel-summary', projectId, weekStart ? format(weekStart, 'yyyy-MM-dd') : null, holidayMultiplier],
    queryFn: async (): Promise<PersonnelWeeklySummary[]> => {
      if (!projectId || !weekStart || !weekEnd) return [];
      
      // Get time entries for this project and week
      // Include hourly_rate and is_holiday from the entry itself
      const { data: entries, error } = await supabase
        .from('time_entries')
        .select(`
          personnel_id,
          hours,
          hourly_rate,
          is_holiday,
          personnel:personnel_id (
            id,
            first_name,
            last_name,
            hourly_rate
          )
        `)
        .eq('project_id', projectId)
        .gte('entry_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('entry_date', format(weekEnd, 'yyyy-MM-dd'));
      
      if (error) throw error;
      
      // Group by personnel and calculate totals
      // Use the snapshotted hourly_rate from time_entries, fallback to personnel.hourly_rate
      const personnelMap = new Map<string, PersonnelWeeklySummary & { rateSource: 'entry' | 'personnel' }>();
      
      for (const entry of entries || []) {
        if (!entry.personnel_id || !entry.personnel) continue;
        
        const personnel = entry.personnel as any;
        const existing = personnelMap.get(entry.personnel_id);
        const isHoliday = (entry as any).is_holiday === true;
        const entryHours = entry.hours || 0;
        
        // Use entry's hourly_rate if available (snapshotted), otherwise use personnel's current rate
        const entryRate = (entry as any).hourly_rate ?? personnel.hourly_rate ?? 0;
        
        if (existing) {
          existing.total_hours += entryHours;
          if (isHoliday) {
            existing.holiday_hours += entryHours;
          }
          // If this entry has a snapshotted rate, prefer it
          if ((entry as any).hourly_rate !== null && existing.rateSource !== 'entry') {
            existing.hourly_rate = entryRate;
            existing.rateSource = 'entry';
          }
        } else {
          personnelMap.set(entry.personnel_id, {
            personnel_id: entry.personnel_id,
            personnel_name: `${personnel.first_name} ${personnel.last_name}`,
            total_hours: entryHours,
            regular_hours: 0,
            overtime_hours: 0,
            holiday_hours: isHoliday ? entryHours : 0,
            hourly_rate: entryRate,
            regular_amount: 0,
            overtime_amount: 0,
            holiday_amount: 0,
            total_amount: 0,
            rateSource: (entry as any).hourly_rate !== null ? 'entry' : 'personnel',
          });
        }
      }
      
      // Calculate overtime for each person (40hr weekly threshold)
      // Holiday hours are paid at full holiday multiplier, separate from regular/OT
      const summaries: PersonnelWeeklySummary[] = [];
      for (const data of personnelMap.values()) {
        // Calculate regular/OT based on non-holiday hours only
        const nonHolidayHours = data.total_hours - data.holiday_hours;
        const { regularHours, overtimeHours } = calculateSingleEmployeeOvertime(nonHolidayHours, 40);
        
        const summary: PersonnelWeeklySummary = {
          personnel_id: data.personnel_id,
          personnel_name: data.personnel_name,
          total_hours: data.total_hours,
          regular_hours: regularHours,
          overtime_hours: overtimeHours,
          holiday_hours: data.holiday_hours,
          hourly_rate: data.hourly_rate,
          regular_amount: regularHours * data.hourly_rate,
          overtime_amount: overtimeHours * data.hourly_rate * 1.5,
          holiday_amount: data.holiday_hours * data.hourly_rate * holidayMultiplier, // Full holiday rate (2x)
          total_amount: 0,
        };
        summary.total_amount = summary.regular_amount + summary.overtime_amount + summary.holiday_amount;
        summaries.push(summary);
      }
      
      return summaries.sort((a, b) => a.personnel_name.localeCompare(b.personnel_name));
    },
    enabled: !!projectId && !!weekStart,
  });
}

export function useCreateLaborExpenses() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      projectId,
      customerId,
      weekCloseoutId,
      weekStartDate,
      personnelSummaries,
    }: {
      projectId: string;
      customerId: string;
      weekCloseoutId: string;
      weekStartDate: Date;
      personnelSummaries: PersonnelWeeklySummary[];
    }) => {
      const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 });
      
      const expenses = personnelSummaries.map(summary => ({
        project_id: projectId,
        customer_id: customerId,
        week_closeout_id: weekCloseoutId,
        personnel_id: summary.personnel_id,
        personnel_name: summary.personnel_name,
        week_start_date: format(weekStart, 'yyyy-MM-dd'),
        week_end_date: format(weekEnd, 'yyyy-MM-dd'),
        regular_hours: summary.regular_hours,
        overtime_hours: summary.overtime_hours,
        hourly_rate: summary.hourly_rate,
        overtime_rate: summary.hourly_rate * 1.5,
        total_amount: summary.total_amount,
        status: 'pending',
        billable: true,
      }));
      
      const { data, error } = await supabase
        .from('project_labor_expenses')
        .insert(expenses)
        .select();
      
      if (error) throw error;
      return data as ProjectLaborExpense[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-labor-expenses'] });
      toast.success('Labor expenses created');
    },
    onError: (error) => {
      toast.error('Failed to create labor expenses: ' + error.message);
    },
  });
}
