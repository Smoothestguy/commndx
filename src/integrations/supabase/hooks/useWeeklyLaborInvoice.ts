import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { toast } from "sonner";
import { PersonnelWeeklySummary } from "./useProjectLaborExpenses";
import { getNextInvoiceNumber } from "@/utils/invoiceNumberGenerator";

export function useCreateWeeklyLaborInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      customerId,
      customerName,
      projectId,
      projectName,
      jobOrderId,
      weekStartDate,
      personnelSummaries,
      laborExpenseIds,
      taxRate = 0,
    }: {
      customerId: string;
      customerName: string;
      projectId: string;
      projectName?: string;
      jobOrderId?: string;
      weekStartDate: Date;
      personnelSummaries: PersonnelWeeklySummary[];
      laborExpenseIds: string[];
      taxRate?: number;
    }) => {
      const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 });
      const weekLabel = format(weekStart, 'MMM d, yyyy');
      
      // Calculate totals
      const subtotal = personnelSummaries.reduce((sum, p) => sum + p.total_amount, 0);
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;
      
      // Get fresh invoice number from QuickBooks (or local fallback)
      const { number: invoiceNumber, source } = await getNextInvoiceNumber();
      console.log(`Generated weekly labor invoice number ${invoiceNumber} from ${source}`);
      
      // Create invoice with QuickBooks-synced number
      const invoiceData = {
        number: invoiceNumber,
        customer_id: customerId,
        customer_name: customerName,
        project_name: projectName || null,
        job_order_id: jobOrderId || null,
        due_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        status: 'draft' as const,
      };
      
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoiceData])
        .select()
        .single();
      
      if (invoiceError) throw invoiceError;
      
      // Create line items for each personnel
      const lineItems = personnelSummaries.map((summary) => {
        const description = `Week of ${weekLabel} - ${summary.personnel_name} - ${summary.regular_hours}h Regular${summary.overtime_hours > 0 ? ` + ${summary.overtime_hours}h OT` : ''}`;
        return {
          invoice_id: invoice.id,
          description,
          quantity: 1,
          unit_price: summary.total_amount,
          markup: 0,
          total: summary.total_amount,
        };
      });
      
      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .insert(lineItems);
      
      if (lineItemsError) throw lineItemsError;
      
      // Create weekly labor invoice tracking record
      const { data: weeklyInvoice, error: weeklyError } = await supabase
        .from('weekly_labor_invoices')
        .insert({
          invoice_id: invoice.id,
          customer_id: customerId,
          project_id: projectId,
          week_start_date: format(weekStart, 'yyyy-MM-dd'),
          week_end_date: format(weekEnd, 'yyyy-MM-dd'),
        })
        .select()
        .single();
      
      if (weeklyError) throw weeklyError;
      
      // Link labor expenses to the weekly invoice
      if (laborExpenseIds.length > 0) {
        const sources = laborExpenseIds.map(expenseId => ({
          weekly_labor_invoice_id: weeklyInvoice.id,
          project_labor_expense_id: expenseId,
        }));
        
        const { error: sourcesError } = await supabase
          .from('weekly_labor_invoice_sources')
          .insert(sources);
        
        if (sourcesError) throw sourcesError;
        
        // Update labor expenses status to 'invoiced' and link invoice
        const { error: updateError } = await supabase
          .from('project_labor_expenses')
          .update({ 
            status: 'invoiced',
            invoice_id: invoice.id,
          })
          .in('id', laborExpenseIds);
        
        if (updateError) throw updateError;
      }
      
      return invoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['project-labor-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-labor-invoices'] });
      toast.success('Labor invoice created', {
        action: {
          label: 'View Invoice',
          onClick: () => window.location.href = `/invoices/${invoice.id}`,
        },
      });
    },
    onError: (error) => {
      toast.error('Failed to create invoice: ' + error.message);
    },
  });
}
