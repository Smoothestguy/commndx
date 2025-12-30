import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export type TrashEntityType = 
  | "purchase_order"
  | "invoice"
  | "estimate"
  | "vendor_bill"
  | "job_order"
  | "change_order"
  | "customer"
  | "vendor"
  | "personnel"
  | "project"
  | "product";

export interface DeletedItem {
  id: string;
  entity_type: TrashEntityType;
  identifier: string;
  name?: string;
  deleted_at: string;
  deleted_by: string | null;
}

const TABLE_MAP: Record<TrashEntityType, string> = {
  purchase_order: "purchase_orders",
  invoice: "invoices",
  estimate: "estimates",
  vendor_bill: "vendor_bills",
  job_order: "job_orders",
  change_order: "change_orders",
  customer: "customers",
  vendor: "vendors",
  personnel: "personnel",
  project: "projects",
  product: "products",
};

const ENTITY_LABELS: Record<TrashEntityType, string> = {
  purchase_order: "Purchase Order",
  invoice: "Invoice",
  estimate: "Estimate",
  vendor_bill: "Vendor Bill",
  job_order: "Job Order",
  change_order: "Change Order",
  customer: "Customer",
  vendor: "Vendor",
  personnel: "Personnel",
  project: "Project",
  product: "Product",
};

export const getEntityLabel = (entityType: TrashEntityType): string => {
  return ENTITY_LABELS[entityType] || entityType;
};

// Fetch all deleted items
export const useDeletedItems = (entityType?: TrashEntityType, limit = 50) => {
  return useQuery({
    queryKey: ["deleted_items", entityType, limit],
    queryFn: async () => {
      const items: DeletedItem[] = [];

      // Define which tables to query based on entityType filter
      const tables = entityType
        ? { [entityType]: TABLE_MAP[entityType] }
        : TABLE_MAP;

      for (const [type, table] of Object.entries(tables)) {
        try {
          const { data, error } = await supabase
            .from(table as keyof typeof TABLE_MAP extends never ? never : any)
            .select("*")
            .not("deleted_at", "is", null)
            .order("deleted_at", { ascending: false })
            .limit(limit);

          if (error) {
            console.error(`Error fetching deleted ${type}:`, error);
            continue;
          }

          data?.forEach((item: any) => {
            let identifier = item.number || item.name || item.personnel_number || item.id;
            let name = item.name;
            
            if (type === "personnel") {
              identifier = item.personnel_number || item.id;
              name = `${item.first_name || ""} ${item.last_name || ""}`.trim();
            } else if (type === "customer" || type === "vendor" || type === "project" || type === "product") {
              identifier = item.name || item.id;
            }
            
            items.push({
              id: item.id,
              entity_type: type as TrashEntityType,
              identifier,
              name,
              deleted_at: item.deleted_at,
              deleted_by: item.deleted_by,
            });
          });
        } catch (err) {
          console.error(`Error processing ${type}:`, err);
        }
      }

      // Sort by deleted_at descending
      items.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());

      return items.slice(0, limit);
    },
  });
};

// Restore a deleted item
export const useRestoreItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entityType, id }: { entityType: TrashEntityType; id: string }) => {
      const table = TABLE_MAP[entityType];

      const { error } = await supabase
        .from(table as any)
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", id);

      if (error) throw error;
      return { entityType, id };
    },
    onSuccess: ({ entityType }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["deleted_items"] });
      queryClient.invalidateQueries({ queryKey: [TABLE_MAP[entityType].replace("_", "-")] });
      queryClient.invalidateQueries({ queryKey: [TABLE_MAP[entityType]] });
      toast.success(`${getEntityLabel(entityType)} restored successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to restore item: ${error.message}`);
    },
  });
};

// Permanently delete an item
export const usePermanentlyDelete = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entityType, id }: { entityType: TrashEntityType; id: string }) => {
      const table = TABLE_MAP[entityType];

      const { error } = await supabase.from(table as any).delete().eq("id", id);

      if (error) throw error;
      return { entityType, id };
    },
    onSuccess: ({ entityType }) => {
      queryClient.invalidateQueries({ queryKey: ["deleted_items"] });
      toast.success(`${getEntityLabel(entityType)} permanently deleted`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to permanently delete: ${error.message}`);
    },
  });
};
