import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { toast } from "sonner";
import { calculateSingleEmployeeOvertime } from "@/lib/overtimeUtils";

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
  hourly_rate: number;
  regular_amount: number;
  overtime_amount: number;
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

export function useWeeklyPersonnelSummary(projectId: string | undefined, weekStartDate: Date | undefined) {
  const weekStart = weekStartDate ? startOfWeek(weekStartDate, { weekStartsOn: 1 }) : null;
  const weekEnd = weekStart ? endOfWeek(weekStartDate!, { weekStartsOn: 1 }) : null;
  
  return useQuery({
    queryKey: ['weekly-personnel-summary', projectId, weekStart ? format(weekStart, 'yyyy-MM-dd') : null],
    queryFn: async (): Promise<PersonnelWeeklySummary[]> => {
      if (!projectId || !weekStart || !weekEnd) return [];
      
      // Get time entries for this project and week
      const { data: entries, error } = await supabase
        .from('time_entries')
        .select(`
          personnel_id,
          hours,
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
      const personnelMap = new Map<string, PersonnelWeeklySummary>();
      
      for (const entry of entries || []) {
        if (!entry.personnel_id || !entry.personnel) continue;
        
        const personnel = entry.personnel as any;
        const existing = personnelMap.get(entry.personnel_id);
        
        if (existing) {
          existing.total_hours += entry.hours || 0;
        } else {
          personnelMap.set(entry.personnel_id, {
            personnel_id: entry.personnel_id,
            personnel_name: `${personnel.first_name} ${personnel.last_name}`,
            total_hours: entry.hours || 0,
            regular_hours: 0,
            overtime_hours: 0,
            hourly_rate: personnel.hourly_rate || 0,
            regular_amount: 0,
            overtime_amount: 0,
            total_amount: 0,
          });
        }
      }
      
      // Calculate overtime for each person (40hr weekly threshold)
      const summaries: PersonnelWeeklySummary[] = [];
      for (const summary of personnelMap.values()) {
        const { regularHours, overtimeHours } = calculateSingleEmployeeOvertime(summary.total_hours, 40);
        summary.regular_hours = regularHours;
        summary.overtime_hours = overtimeHours;
        summary.regular_amount = regularHours * summary.hourly_rate;
        summary.overtime_amount = overtimeHours * summary.hourly_rate * 1.5;
        summary.total_amount = summary.regular_amount + summary.overtime_amount;
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
