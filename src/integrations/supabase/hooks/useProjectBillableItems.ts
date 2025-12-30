import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BillableJobOrder {
  id: string;
  number: string;
  total: number;
  invoiced_amount: number;
  remaining_amount: number;
  status: string;
  created_at: string;
  type: 'job_order';
}

export interface BillableChangeOrder {
  id: string;
  number: string;
  reason: string;
  description: string | null;
  total: number;
  invoiced_amount: number;
  remaining_amount: number;
  status: string;
  change_type: 'additive' | 'deductive';
  created_at: string;
  type: 'change_order';
}

export interface BillableTMTicket {
  id: string;
  ticket_number: string;
  description: string | null;
  total: number;
  status: string;
  change_type: 'additive' | 'deductive';
  work_date: string;
  type: 'tm_ticket';
}

export type BillableItem = BillableJobOrder | BillableChangeOrder | BillableTMTicket;

export const useProjectBillableItems = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ["project-billable-items", projectId],
    queryFn: async () => {
      if (!projectId) return { jobOrders: [], changeOrders: [], tmTickets: [] };

      // Fetch job orders with remaining uninvoiced amounts
      const { data: jobOrders, error: joError } = await supabase
        .from("job_orders")
        .select(`
          id,
          number,
          total,
          invoiced_amount,
          remaining_amount,
          status,
          created_at
        `)
        .eq("project_id", projectId)
        .in("status", ["active", "in-progress", "completed"])
        .gt("remaining_amount", 0)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (joError) throw joError;

      const billableJobOrders: BillableJobOrder[] = (jobOrders || []).map(jo => ({
        ...jo,
        type: 'job_order' as const,
      }));

      // Fetch approved change orders with remaining uninvoiced amounts
      const { data: changeOrders, error: coError } = await supabase
        .from("change_orders")
        .select(`
          id,
          number,
          reason,
          description,
          total,
          invoiced_amount,
          remaining_amount,
          status,
          change_type,
          created_at
        `)
        .eq("project_id", projectId)
        .eq("status", "approved")
        .gt("remaining_amount", 0)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (coError) throw coError;

      const billableChangeOrders: BillableChangeOrder[] = (changeOrders || []).map(co => ({
        ...co,
        change_type: co.change_type as 'additive' | 'deductive',
        type: 'change_order' as const,
      }));

      // Fetch approved/signed T&M tickets that are not yet invoiced
      const { data: tmTickets, error: tmError } = await supabase
        .from("tm_tickets")
        .select(`
          id,
          ticket_number,
          description,
          total,
          status,
          change_type,
          work_date
        `)
        .eq("project_id", projectId)
        .in("status", ["approved", "signed"])
        .order("work_date", { ascending: false });

      if (tmError) throw tmError;

      // Check which T&M tickets already have invoices
      const { data: invoicedTMs } = await supabase
        .from("invoices")
        .select("tm_ticket_id")
        .eq("project_id", projectId)
        .not("tm_ticket_id", "is", null)
        .is("deleted_at", null);

      const invoicedTMIds = new Set((invoicedTMs || []).map(i => i.tm_ticket_id));

      const uninvoicedTMTickets: BillableTMTicket[] = (tmTickets || [])
        .filter(tm => !invoicedTMIds.has(tm.id))
        .map(tm => ({
          ...tm,
          change_type: tm.change_type as 'additive' | 'deductive',
          type: 'tm_ticket' as const,
        }));

      return {
        jobOrders: billableJobOrders,
        changeOrders: billableChangeOrders,
        tmTickets: uninvoicedTMTickets,
      };
    },
    enabled: !!projectId,
  });
};
