import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EstimateVersion {
  id: string;
  estimate_id: string;
  version_number: number;
  snapshot: {
    customer_id: string;
    customer_name: string;
    project_id: string | null;
    project_name: string | null;
    status: string;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    notes: string | null;
    valid_until: string;
    default_pricing_type: string | null;
    line_items: Array<{
      product_id: string | null;
      description: string;
      quantity: number;
      unit_price: number;
      markup: number;
      pricing_type: string | null;
      is_taxable: boolean;
      total: number;
    }>;
  };
  created_at: string;
  created_by: string | null;
  created_by_email: string | null;
  change_summary: string | null;
}

export function useEstimateVersions(estimateId: string | undefined) {
  return useQuery({
    queryKey: ["estimate-versions", estimateId],
    queryFn: async () => {
      if (!estimateId) return [];
      
      const { data, error } = await supabase
        .from("estimate_versions")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return data as EstimateVersion[];
    },
    enabled: !!estimateId,
  });
}

export function useCreateEstimateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      estimateId,
      snapshot,
      changeSummary,
    }: {
      estimateId: string;
      snapshot: EstimateVersion["snapshot"];
      changeSummary?: string;
    }) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get the next version number
      const { data: existingVersions } = await supabase
        .from("estimate_versions")
        .select("version_number")
        .eq("estimate_id", estimateId)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersionNumber = existingVersions && existingVersions.length > 0
        ? existingVersions[0].version_number + 1
        : 1;

      const { data, error } = await supabase
        .from("estimate_versions")
        .insert({
          estimate_id: estimateId,
          version_number: nextVersionNumber,
          snapshot,
          created_by: user?.id,
          created_by_email: user?.email,
          change_summary: changeSummary,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["estimate-versions", variables.estimateId] });
    },
  });
}

export function useRestoreEstimateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      estimateId,
      versionId,
    }: {
      estimateId: string;
      versionId: string;
    }) => {
      // Get the version to restore
      const { data: version, error: versionError } = await supabase
        .from("estimate_versions")
        .select("*")
        .eq("id", versionId)
        .single();

      if (versionError) throw versionError;

      const snapshot = version.snapshot as EstimateVersion["snapshot"];

      // First, save current state as a new version
      const { data: currentEstimate } = await supabase
        .from("estimates")
        .select("*, line_items:estimate_line_items(*)")
        .eq("id", estimateId)
        .single();

      if (currentEstimate) {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data: existingVersions } = await supabase
          .from("estimate_versions")
          .select("version_number")
          .eq("estimate_id", estimateId)
          .order("version_number", { ascending: false })
          .limit(1);

        const nextVersionNumber = existingVersions && existingVersions.length > 0
          ? existingVersions[0].version_number + 1
          : 1;

        // Save current state before restoring
        await supabase.from("estimate_versions").insert({
          estimate_id: estimateId,
          version_number: nextVersionNumber,
          snapshot: {
            customer_id: currentEstimate.customer_id,
            customer_name: currentEstimate.customer_name,
            project_id: currentEstimate.project_id,
            project_name: currentEstimate.project_name,
            status: currentEstimate.status,
            subtotal: currentEstimate.subtotal,
            tax_rate: currentEstimate.tax_rate,
            tax_amount: currentEstimate.tax_amount,
            total: currentEstimate.total,
            notes: currentEstimate.notes,
            valid_until: currentEstimate.valid_until,
            default_pricing_type: currentEstimate.default_pricing_type,
            line_items: currentEstimate.line_items.map((item: any) => ({
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              markup: item.markup,
              pricing_type: item.pricing_type,
              is_taxable: item.is_taxable,
              total: item.total,
            })),
          },
          created_by: user?.id,
          created_by_email: user?.email,
          change_summary: `Auto-saved before restoring to version ${version.version_number}`,
        });
      }

      // Update the estimate
      const { error: updateError } = await supabase
        .from("estimates")
        .update({
          customer_id: snapshot.customer_id,
          customer_name: snapshot.customer_name,
          project_id: snapshot.project_id,
          project_name: snapshot.project_name,
          status: snapshot.status as "draft" | "pending" | "sent" | "approved",
          subtotal: snapshot.subtotal,
          tax_rate: snapshot.tax_rate,
          tax_amount: snapshot.tax_amount,
          total: snapshot.total,
          notes: snapshot.notes,
          valid_until: snapshot.valid_until,
          default_pricing_type: snapshot.default_pricing_type,
        })
        .eq("id", estimateId);

      if (updateError) throw updateError;

      // Delete existing line items
      await supabase
        .from("estimate_line_items")
        .delete()
        .eq("estimate_id", estimateId);

      // Insert restored line items
      if (snapshot.line_items && snapshot.line_items.length > 0) {
        const { error: lineItemsError } = await supabase
          .from("estimate_line_items")
          .insert(
            snapshot.line_items.map((item, index) => ({
              estimate_id: estimateId,
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              markup: item.markup,
              pricing_type: item.pricing_type,
              is_taxable: item.is_taxable,
              total: item.total,
              sort_order: index,
            }))
          );

        if (lineItemsError) throw lineItemsError;
      }

      return { success: true, versionNumber: version.version_number };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["estimate", variables.estimateId] });
      queryClient.invalidateQueries({ queryKey: ["estimate-versions", variables.estimateId] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success(`Restored to version ${result.versionNumber}`);
    },
    onError: (error) => {
      toast.error("Failed to restore version");
      console.error("Restore error:", error);
    },
  });
}
