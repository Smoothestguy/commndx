import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EntityType = "customer" | "vendor" | "personnel";

export interface DuplicateMatch {
  duplicate_id: string;
  duplicate_name: string;
  duplicate_email: string | null;
  duplicate_phone: string | null;
  duplicate_company?: string | null;
  duplicate_tax_id?: string | null;
  duplicate_ssn_last_four?: string | null;
  match_type: string;
  match_score: number;
}

export interface MergeRequest {
  entityType: EntityType;
  sourceId: string;
  targetId: string;
  fieldResolutions: Record<string, "source" | "target">;
  quickbooksResolution?: {
    keepSourceQB: boolean;
  };
  mergeReason?: string;
}

export interface MergeResult {
  success: boolean;
  error?: string;
  auditId?: string;
  recordsUpdated?: Record<string, number>;
}

export interface MergeAuditRecord {
  id: string;
  entity_type: EntityType;
  source_entity_id: string;
  target_entity_id: string;
  source_entity_snapshot: Record<string, unknown>;
  target_entity_snapshot: Record<string, unknown>;
  merged_entity_snapshot: Record<string, unknown>;
  field_overrides: Record<string, string>;
  related_records_updated: Record<string, number>;
  quickbooks_resolution: Record<string, unknown> | null;
  merged_at: string;
  merged_by: string;
  merged_by_email: string;
  notes: string | null;
  is_reversed: boolean;
}

// Hook to find potential duplicates for an entity
export function useDuplicateCheck(entityType: EntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: ["duplicates", entityType, entityId],
    queryFn: async (): Promise<DuplicateMatch[]> => {
      if (!entityId) return [];

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("entity-duplicate-check", {
        body: { entityType, entityId },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (error) throw error;
      return data.duplicates || [];
    },
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to perform entity merge
export function useEntityMerge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: MergeRequest): Promise<MergeResult> => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("entity-merge", {
        body: request,
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Merge failed");

      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries based on entity type
      queryClient.invalidateQueries({ queryKey: [variables.entityType + "s"] });
      queryClient.invalidateQueries({ queryKey: ["duplicates"] });
      
      // Show success message with record counts
      const recordCount = Object.values(data.recordsUpdated || {}).reduce((a, b) => a + b, 0);
      toast.success(`Merge completed successfully. ${recordCount} related records updated.`);
    },
    onError: (error: Error) => {
      toast.error(`Merge failed: ${error.message}`);
    },
  });
}

// Hook to get merge audit history for an entity
export function useMergeAuditHistory(entityType: EntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: ["merge-audit", entityType, entityId],
    queryFn: async (): Promise<MergeAuditRecord[]> => {
      if (!entityId) return [];

      const { data, error } = await supabase
        .from("entity_merge_audit")
        .select("*")
        .eq("entity_type", entityType)
        .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`)
        .order("merged_at", { ascending: false });

      if (error) throw error;
      return (data || []) as MergeAuditRecord[];
    },
    enabled: !!entityId,
  });
}

// Hook to get entity merge preview (impact analysis)
export function useMergePreview(entityType: EntityType, sourceId: string | undefined, targetId: string | undefined) {
  return useQuery({
    queryKey: ["merge-preview", entityType, sourceId, targetId],
    queryFn: async () => {
      if (!sourceId || !targetId) return null;

      let preview = {
        invoices: 0,
        invoiceTotal: 0,
        bills: 0,
        billTotal: 0,
        projects: 0,
        timeEntries: 0,
        payments: 0,
        paymentTotal: 0,
      };

      if (entityType === "customer") {
        // Get invoice counts and totals
        const { data: invoices } = await supabase
          .from("invoices")
          .select("id, total")
          .eq("customer_id", sourceId);
        
        preview.invoices = invoices?.length || 0;
        preview.invoiceTotal = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;

        // Get project count
        const { data: projects } = await supabase
          .from("projects")
          .select("id")
          .eq("customer_id", sourceId);
        
        preview.projects = projects?.length || 0;

      } else if (entityType === "vendor") {
        // Get bill counts and totals
        const { data: bills } = await supabase
          .from("vendor_bills")
          .select("id, total")
          .eq("vendor_id", sourceId);
        
        preview.bills = bills?.length || 0;
        preview.billTotal = bills?.reduce((sum, bill) => sum + (bill.total || 0), 0) || 0;

        // Get PO count
        const { data: pos } = await supabase
          .from("purchase_orders")
          .select("id")
          .eq("vendor_id", sourceId);
        
        preview.projects = pos?.length || 0;

      } else if (entityType === "personnel") {
        // Get time entry count
        const { data: timeEntries } = await supabase
          .from("time_entries")
          .select("id")
          .eq("personnel_id", sourceId);
        
        preview.timeEntries = timeEntries?.length || 0;

        // Get payment counts
        const { data: payments } = await supabase
          .from("personnel_payments")
          .select("id, gross_amount")
          .eq("personnel_id", sourceId);
        
        preview.payments = payments?.length || 0;
        preview.paymentTotal = payments?.reduce((sum, p) => sum + (Number(p.gross_amount) || 0), 0) || 0;
      }

      return preview;
    },
    enabled: !!sourceId && !!targetId,
  });
}

// Helper to get match type display text
export function getMatchTypeLabel(matchType: string): string {
  const labels: Record<string, string> = {
    email: "Email Match",
    phone: "Phone Match",
    tax_id: "Tax ID Match",
    ssn: "SSN Match",
    name: "Name Match",
    name_company: "Name + Company Match",
    fuzzy: "Similar Name",
  };
  return labels[matchType] || matchType;
}

// Helper to get match type color
export function getMatchTypeColor(matchType: string): string {
  const colors: Record<string, string> = {
    email: "bg-blue-500",
    phone: "bg-green-500",
    tax_id: "bg-red-500",
    ssn: "bg-red-500",
    name: "bg-purple-500",
    name_company: "bg-purple-500",
    fuzzy: "bg-yellow-500",
  };
  return colors[matchType] || "bg-gray-500";
}
