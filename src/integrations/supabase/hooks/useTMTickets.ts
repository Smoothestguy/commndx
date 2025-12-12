import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export type TMTicketStatus = 'draft' | 'pending_signature' | 'signed' | 'approved' | 'invoiced' | 'void';
export type ChangeType = 'additive' | 'deductive';

export interface TMTicketLineItem {
  id: string;
  tm_ticket_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  total: number;
  is_taxable: boolean;
  sort_order: number;
  created_at: string;
}

export interface TMTicket {
  id: string;
  ticket_number: string;
  project_id: string;
  customer_id: string;
  vendor_id: string | null;
  purchase_order_id: string | null;
  status: TMTicketStatus;
  description: string | null;
  work_date: string;
  created_in_field: boolean;
  customer_rep_name: string | null;
  customer_rep_title: string | null;
  customer_rep_email: string | null;
  signature_data: string | null;
  signed_at: string | null;
  approval_token: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  change_type: ChangeType;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TMTicketWithLineItems extends TMTicket {
  line_items: TMTicketLineItem[];
  project?: { name: string };
  customer?: { name: string; company: string | null };
  vendor?: { name: string } | null;
}

export const useTMTickets = () => {
  return useQuery({
    queryKey: ["tm-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tm_tickets")
        .select(`
          *,
          project:projects(name),
          customer:customers(name, company),
          vendor:vendors(name),
          line_items:tm_ticket_line_items(*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as TMTicketWithLineItems[];
    },
  });
};

export const useTMTicketsByProject = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ["tm-tickets", "project", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("tm_tickets")
        .select(`
          *,
          project:projects(name),
          customer:customers(name, company),
          vendor:vendors(name),
          line_items:tm_ticket_line_items(*)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as TMTicketWithLineItems[];
    },
    enabled: !!projectId,
  });
};

export const useTMTicket = (id: string | undefined) => {
  return useQuery({
    queryKey: ["tm-tickets", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("tm_tickets")
        .select(`
          *,
          project:projects(name),
          customer:customers(name, company),
          vendor:vendors(name),
          line_items:tm_ticket_line_items(*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Sort line items by sort_order
      if (data.line_items) {
        data.line_items.sort((a: TMTicketLineItem, b: TMTicketLineItem) => a.sort_order - b.sort_order);
      }
      
      return data as TMTicketWithLineItems;
    },
    enabled: !!id,
  });
};

export const useTMTicketByToken = (token: string | undefined) => {
  return useQuery({
    queryKey: ["tm-tickets", "token", token],
    queryFn: async () => {
      if (!token) return null;
      
      const { data, error } = await supabase
        .from("tm_tickets")
        .select(`
          *,
          project:projects(name),
          customer:customers(name, company),
          vendor:vendors(name),
          line_items:tm_ticket_line_items(*)
        `)
        .eq("approval_token", token)
        .single();

      if (error) throw error;
      return data as TMTicketWithLineItems;
    },
    enabled: !!token,
  });
};

interface AddTMTicketParams {
  project_id: string;
  customer_id: string;
  vendor_id?: string;
  purchase_order_id?: string;
  description?: string;
  work_date: string;
  created_in_field?: boolean;
  customer_rep_name?: string;
  customer_rep_title?: string;
  customer_rep_email?: string;
  tax_rate: number;
  notes?: string;
  change_type?: ChangeType;
  lineItems: {
    product_id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    markup: number;
    total: number;
    is_taxable?: boolean;
    sort_order: number;
  }[];
  sendForSignature?: boolean;
}

export const useAddTMTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AddTMTicketParams) => {
      // Calculate totals
      const subtotal = params.lineItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
      const taxableItems = params.lineItems.filter(item => item.is_taxable !== false);
      const taxableSubtotal = taxableItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
      const tax_amount = taxableSubtotal * (params.tax_rate / 100);
      const total = params.lineItems.reduce((sum, item) => sum + item.total, 0) + tax_amount;

      // Generate approval token if sending for signature
      const approval_token = params.sendForSignature ? crypto.randomUUID() : null;

      const { data: ticket, error: ticketError } = await supabase
        .from("tm_tickets")
        .insert([{
          ticket_number: '', // Will be auto-generated by trigger
          project_id: params.project_id,
          customer_id: params.customer_id,
          vendor_id: params.vendor_id || null,
          purchase_order_id: params.purchase_order_id || null,
          description: params.description || null,
          work_date: params.work_date,
          created_in_field: params.created_in_field || false,
          customer_rep_name: params.customer_rep_name || null,
          customer_rep_title: params.customer_rep_title || null,
          customer_rep_email: params.customer_rep_email || null,
          status: params.sendForSignature ? 'pending_signature' : 'draft',
          approval_token,
          subtotal,
          tax_rate: params.tax_rate,
          tax_amount,
          total,
          notes: params.notes || null,
          change_type: params.change_type || 'additive',
        }])
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Insert line items
      if (params.lineItems.length > 0) {
        const lineItemsData = params.lineItems.map((item) => ({
          tm_ticket_id: ticket.id,
          product_id: item.product_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          markup: item.markup,
          total: item.total,
          is_taxable: item.is_taxable !== false,
          sort_order: item.sort_order,
        }));

        const { error: lineItemsError } = await supabase
          .from("tm_ticket_line_items")
          .insert(lineItemsData);

        if (lineItemsError) throw lineItemsError;
      }

      // Send for signature if requested
      if (params.sendForSignature && params.customer_rep_email) {
        await supabase.functions.invoke('send-tm-ticket-signature', {
          body: { ticketId: ticket.id },
        });
      }

      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tm-tickets"] });
      toast.success("T&M ticket created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create T&M ticket: ${error.message}`);
    },
  });
};

interface UpdateTMTicketParams {
  id: string;
  updates: Partial<{
    description: string;
    work_date: string;
    vendor_id: string | null;
    purchase_order_id: string | null;
    customer_rep_name: string;
    customer_rep_title: string;
    customer_rep_email: string;
    status: TMTicketStatus;
    tax_rate: number;
    notes: string;
  }>;
  lineItems?: {
    product_id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    markup: number;
    total: number;
    is_taxable?: boolean;
    sort_order: number;
  }[];
  sendForSignature?: boolean;
}

export const useUpdateTMTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates, lineItems, sendForSignature }: UpdateTMTicketParams) => {
      let updateData: any = { ...updates };

      // Recalculate totals if line items provided
      if (lineItems) {
        const subtotal = lineItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
        const taxRate = updates.tax_rate ?? 0;
        const taxableItems = lineItems.filter(item => item.is_taxable !== false);
        const taxableSubtotal = taxableItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
        const tax_amount = taxableSubtotal * (taxRate / 100);
        const total = lineItems.reduce((sum, item) => sum + item.total, 0) + tax_amount;

        updateData = {
          ...updateData,
          subtotal,
          tax_amount,
          total,
        };
      }

      // Handle signature request
      if (sendForSignature) {
        updateData.approval_token = crypto.randomUUID();
        updateData.status = 'pending_signature';
      }

      const { data: ticket, error: ticketError } = await supabase
        .from("tm_tickets")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Update line items if provided
      if (lineItems) {
        // Delete existing line items
        await supabase
          .from("tm_ticket_line_items")
          .delete()
          .eq("tm_ticket_id", id);

        // Insert new line items
        if (lineItems.length > 0) {
          const lineItemsData = lineItems.map((item) => ({
            tm_ticket_id: id,
            product_id: item.product_id || null,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            markup: item.markup,
            total: item.total,
            is_taxable: item.is_taxable !== false,
            sort_order: item.sort_order,
          }));

          const { error: lineItemsError } = await supabase
            .from("tm_ticket_line_items")
            .insert(lineItemsData);

          if (lineItemsError) throw lineItemsError;
        }
      }

      // Send for signature if requested
      if (sendForSignature && updateData.customer_rep_email) {
        await supabase.functions.invoke('send-tm-ticket-signature', {
          body: { ticketId: id },
        });
      }

      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tm-tickets"] });
      toast.success("T&M ticket updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update T&M ticket: ${error.message}`);
    },
  });
};

export const useDeleteTMTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tm_tickets")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tm-tickets"] });
      toast.success("T&M ticket deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete T&M ticket: ${error.message}`);
    },
  });
};

export const useSignTMTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, signature_data }: { id: string; signature_data: string }) => {
      const { data, error } = await supabase
        .from("tm_tickets")
        .update({
          signature_data,
          signed_at: new Date().toISOString(),
          status: 'signed',
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tm-tickets"] });
      toast.success("T&M ticket signed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to sign T&M ticket: ${error.message}`);
    },
  });
};

export const useApproveTMTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("tm_tickets")
        .update({ status: 'approved' })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tm-tickets"] });
      toast.success("T&M ticket approved successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve T&M ticket: ${error.message}`);
    },
  });
};
