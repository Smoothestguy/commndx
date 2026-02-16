import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentSubcontractor } from "./useSubcontractorPortal";
import { toast } from "sonner";

export interface ContractorRoom {
  id: string;
  unit_number: string;
  floor_number: number | null;
  status: string;
  project_id: string;
  project_name: string;
  notes: string | null;
  scope_items: RoomScopeItemWithBilling[];
}

export interface RoomScopeItemWithBilling {
  id: string;
  room_id: string;
  job_order_line_item_id: string;
  allocated_quantity: number;
  completed_quantity: number;
  billed_quantity: number;
  scope_code: string | null;
  scope_description: string | null;
  unit: string | null;
  status: string;
  unit_cost: number; // from po_line_items
}

export interface CompletionBill {
  id: string;
  room_id: string;
  contractor_id: string;
  project_id: string;
  total_amount: number;
  status: string;
  rejection_notes: string | null;
  submitted_at: string;
  verified_at: string | null;
  approved_at: string | null;
  accounting_approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  room_unit_number?: string;
  project_name?: string;
  items?: CompletionBillItem[];
}

export interface CompletionBillItem {
  id: string;
  bill_id: string;
  room_scope_item_id: string;
  job_order_line_item_id: string;
  description: string;
  quantity: number;
  unit_cost: number;
  total: number;
}

// Get rooms assigned to the current subcontractor with scope items
export function useContractorRooms() {
  const { data: subcontractor } = useCurrentSubcontractor();

  return useQuery({
    queryKey: ["contractor-rooms", subcontractor?.id],
    queryFn: async () => {
      if (!subcontractor?.id) return [];

      // Get rooms assigned to this vendor
      const { data: rooms, error: roomsError } = await (supabase as any)
        .from("project_rooms")
        .select(`
          id,
          unit_number,
          floor_number,
          status,
          project_id,
          notes,
          projects(name)
        `)
        .eq("assigned_vendor_id", subcontractor.id)
        .order("unit_number");

      if (roomsError) throw roomsError;
      if (!rooms || rooms.length === 0) return [];

      const roomIds: string[] = rooms.map((r: any) => String(r.id));

      // Get scope items for these rooms
      const { data: scopeItems, error: scopeError } = await (supabase as any)
        .from("room_scope_items")
        .select(`
          id,
          room_id,
          job_order_line_item_id,
          allocated_quantity,
          completed_quantity,
          billed_quantity,
          scope_code,
          scope_description,
          unit,
          status
        `)
        .in("room_id", roomIds);

      if (scopeError) throw scopeError;

      // Get unit costs from job_order_line_items -> po_line_items
      const joLineItemIds = Array.from(new Set((scopeItems || []).map((s: any) => String(s.job_order_line_item_id))));
      
      let unitCostMap: Record<string, number> = {};
      if (joLineItemIds.length > 0) {
        // Get JO line items to find linked PO line items
        const { data: joLineItems } = await (supabase as any)
          .from("job_order_line_items")
          .select("id, unit_price")
          .in("id", joLineItemIds);

        // For now use JO line item unit_price as the vendor cost
        // In the future, this could look up the PO line item directly
        if (joLineItems) {
          joLineItems.forEach((jo: any) => {
            unitCostMap[jo.id] = jo.unit_price || 0;
          });
        }
      }

      // Combine into ContractorRoom objects
      return rooms.map((room: any) => ({
        id: room.id,
        unit_number: room.unit_number,
        floor_number: room.floor_number,
        status: room.status,
        project_id: room.project_id,
        project_name: room.projects?.name || "Unknown Project",
        notes: room.notes,
        scope_items: (scopeItems || [])
          .filter((s: any) => s.room_id === room.id)
          .map((s: any) => ({
            ...s,
            unit_cost: unitCostMap[s.job_order_line_item_id] || 0,
          })),
      })) as ContractorRoom[];
    },
    enabled: !!subcontractor?.id,
  });
}

// Get completion bills for the current subcontractor
export function useContractorCompletionBills() {
  const { data: subcontractor } = useCurrentSubcontractor();

  return useQuery({
    queryKey: ["contractor-completion-bills", subcontractor?.id],
    queryFn: async () => {
      if (!subcontractor?.id) return [];

      const { data, error } = await (supabase as any)
        .from("contractor_completion_bills")
        .select(`
          *,
          project_rooms(unit_number),
          projects(name)
        `)
        .eq("contractor_id", subcontractor.id)
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((bill: any) => ({
        ...bill,
        room_unit_number: bill.project_rooms?.unit_number || "",
        project_name: bill.projects?.name || "",
      })) as CompletionBill[];
    },
    enabled: !!subcontractor?.id,
  });
}

// Get single completion bill detail
export function useContractorCompletionBill(id: string | undefined) {
  const { data: subcontractor } = useCurrentSubcontractor();

  return useQuery({
    queryKey: ["contractor-completion-bill", id],
    queryFn: async () => {
      if (!id || !subcontractor?.id) return null;

      const { data, error } = await (supabase as any)
        .from("contractor_completion_bills")
        .select(`
          *,
          project_rooms(unit_number),
          projects(name),
          contractor_completion_bill_items(*)
        `)
        .eq("id", id)
        .eq("contractor_id", subcontractor.id)
        .single();

      if (error) throw error;

      return {
        ...data,
        room_unit_number: data.project_rooms?.unit_number || "",
        project_name: data.projects?.name || "",
        items: data.contractor_completion_bill_items || [],
      } as CompletionBill;
    },
    enabled: !!id && !!subcontractor?.id,
  });
}

// Submit completion (auto-generates bill)
export function useSubmitCompletion() {
  const queryClient = useQueryClient();
  const { data: subcontractor } = useCurrentSubcontractor();

  return useMutation({
    mutationFn: async (params: {
      room_id: string;
      project_id: string;
      items: Array<{
        room_scope_item_id: string;
        job_order_line_item_id: string;
        description: string;
        quantity: number;
        unit_cost: number;
      }>;
    }) => {
      if (!subcontractor?.id) throw new Error("Subcontractor not found");

      const lineItems = params.items.map((item) => ({
        ...item,
        total: item.quantity * item.unit_cost,
      }));

      const totalAmount = lineItems.reduce((sum, item) => sum + item.total, 0);

      // Create the completion bill
      const { data: bill, error: billError } = await (supabase as any)
        .from("contractor_completion_bills")
        .insert({
          room_id: params.room_id,
          contractor_id: subcontractor.id,
          project_id: params.project_id,
          total_amount: totalAmount,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (billError) throw billError;

      // Create bill items
      const billItems = lineItems.map((item) => ({
        bill_id: bill.id,
        room_scope_item_id: item.room_scope_item_id,
        job_order_line_item_id: item.job_order_line_item_id,
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total: item.total,
      }));

      const { error: itemsError } = await (supabase as any)
        .from("contractor_completion_bill_items")
        .insert(billItems);

      if (itemsError) throw itemsError;

      // Send notification to field superintendents on this project
      try {
        const { data: assignments } = await (supabase as any)
          .from("project_assignments")
          .select("user_id")
          .eq("project_id", params.project_id)
          .eq("project_role", "field_superintendent")
          .eq("status", "active");

        if (assignments && assignments.length > 0) {
          const notifications = assignments.map((a: any) => ({
            user_id: a.user_id,
            title: `Completion submitted for Unit ${params.items[0]?.description || ""}`,
            message: `${subcontractor.name} submitted a completion bill for $${totalAmount.toFixed(2)}`,
            notification_type: "completion_submitted",
            related_id: bill.id,
            link_url: `/completion-reviews`,
            metadata: {
              bill_id: bill.id,
              contractor_name: subcontractor.name,
              total_amount: totalAmount,
            },
          }));

          await supabase.from("admin_notifications").insert(notifications);
        }
      } catch (e) {
        console.warn("Failed to send notifications:", e);
      }

      return bill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractor-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["contractor-completion-bills"] });
      toast.success("Completion submitted successfully!");
    },
    onError: (error) => {
      toast.error("Failed to submit completion: " + error.message);
    },
  });
}

// Admin: Get completion bills for review
export function useCompletionBillsForReview(status?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["completion-bills-review", status, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = (supabase as any)
        .from("contractor_completion_bills")
        .select(`
          *,
          project_rooms(unit_number),
          projects(name),
          vendors:contractor_id(name),
          contractor_completion_bill_items(*)
        `)
        .order("submitted_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((bill: any) => ({
        ...bill,
        room_unit_number: bill.project_rooms?.unit_number || "",
        project_name: bill.projects?.name || "",
        contractor_name: bill.vendors?.name || "",
        items: bill.contractor_completion_bill_items || [],
      }));
    },
    enabled: !!user?.id,
  });
}

// Admin: Update completion bill status (verify/approve/reject/pay)
export function useUpdateCompletionBillStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      bill_id: string;
      action: "verify" | "approve" | "accounting_approve" | "pay" | "reject";
      notes?: string;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const updates: any = {};
      let newStatus: string;

      switch (params.action) {
        case "verify":
          newStatus = "field_verified";
          updates.verified_at = new Date().toISOString();
          updates.verified_by = user.id;
          break;
        case "approve":
          newStatus = "pm_approved";
          updates.approved_at = new Date().toISOString();
          updates.approved_by = user.id;
          break;
        case "accounting_approve":
          newStatus = "accounting_approved";
          updates.accounting_approved_at = new Date().toISOString();
          updates.accounting_approved_by = user.id;
          break;
        case "pay":
          newStatus = "paid";
          updates.paid_at = new Date().toISOString();
          break;
        case "reject":
          newStatus = "rejected";
          updates.rejection_notes = params.notes || "";
          break;
        default:
          throw new Error("Invalid action");
      }

      updates.status = newStatus;

      const { data, error } = await (supabase as any)
        .from("contractor_completion_bills")
        .update(updates)
        .eq("id", params.bill_id)
        .select(`*, projects(name), project_rooms(unit_number), vendors:contractor_id(name, user_id)`)
        .single();

      if (error) throw error;

      // Send notifications for the next step
      try {
        if (params.action === "verify") {
          // Notify PMs
          const { data: assignments } = await (supabase as any)
            .from("project_assignments")
            .select("user_id")
            .eq("project_id", data.project_id)
            .eq("project_role", "project_manager")
            .eq("status", "active");

          if (assignments?.length) {
            await supabase.from("admin_notifications").insert(
              assignments.map((a: any) => ({
                user_id: a.user_id,
                title: `Completion verified for Unit ${data.project_rooms?.unit_number || ""}`,
                message: `Ready for PM approval - $${data.total_amount.toFixed(2)}`,
                notification_type: "completion_verified",
                related_id: data.id,
                link_url: `/completion-reviews`,
              }))
            );
          }
        } else if (params.action === "approve") {
          // Notify accounting users
          const { data: accountingUsers } = await supabase
            .from("user_roles" as any)
            .select("user_id")
            .eq("role", "accounting");

          if (accountingUsers?.length) {
            await supabase.from("admin_notifications").insert(
              (accountingUsers as any[]).map((u: any) => ({
                user_id: u.user_id,
                title: `Completion approved - ready for payment`,
                message: `${data.vendors?.name || "Contractor"} - Unit ${data.project_rooms?.unit_number || ""} - $${data.total_amount.toFixed(2)}`,
                notification_type: "completion_approved",
                related_id: data.id,
                link_url: `/completion-reviews`,
              }))
            );
          }
        } else if (params.action === "reject" && data.vendors?.user_id) {
          // Notify contractor
          await supabase.from("admin_notifications").insert({
            user_id: data.vendors.user_id,
            title: `Completion rejected for Unit ${data.project_rooms?.unit_number || ""}`,
            message: params.notes || "Your completion was rejected",
            notification_type: "completion_rejected",
            related_id: data.id,
            link_url: `/subcontractor/completions/${data.id}`,
          });
        }
      } catch (e) {
        console.warn("Failed to send notifications:", e);
      }

      return data;
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ["completion-bills-review"] });
      const actionLabels: Record<string, string> = {
        verify: "Verified",
        approve: "Approved",
        accounting_approve: "Approved for payment",
        pay: "Marked as paid",
        reject: "Rejected",
      };
      toast.success(actionLabels[params.action] || "Updated");
    },
    onError: (error) => {
      toast.error("Failed: " + error.message);
    },
  });
}
