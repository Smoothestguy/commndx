import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface DraftEstimateData {
  customer_id?: string;
  customer_name?: string;
  project_id?: string;
  project_name?: string;
  number: string;
  status: "draft";
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes?: string;
  valid_until: string;
  default_pricing_type?: "markup" | "margin";
}

interface DraftLineItem {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  pricing_type?: "markup" | "margin";
  is_taxable?: boolean;
  total: number;
}

interface UseAutoSaveDraftOptions {
  estimateData: DraftEstimateData;
  lineItems: DraftLineItem[];
  enabled?: boolean;
  debounceMs?: number;
}

export function useAutoSaveDraft({
  estimateData,
  lineItems,
  enabled = true,
  debounceMs = 3000,
}: UseAutoSaveDraftOptions) {
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialDataRef = useRef<string>("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Load draft from URL parameter
  useEffect(() => {
    const draftParam = searchParams.get("draft");
    if (draftParam) {
      setDraftId(draftParam);
    }
  }, [searchParams]);

  // Check if there's meaningful data to save
  const hasMeaningfulData = useCallback(() => {
    const hasCustomer = !!estimateData.customer_id;
    const hasDescription = lineItems.some(
      (item) => item.description.trim().length > 0
    );
    const hasPrice = lineItems.some((item) => item.unit_price > 0);

    return hasCustomer || hasDescription || hasPrice;
  }, [estimateData.customer_id, lineItems]);

  // Track changes
  useEffect(() => {
    const currentData = JSON.stringify({ estimateData, lineItems });
    if (initialDataRef.current && currentData !== initialDataRef.current) {
      setHasUnsavedChanges(true);
    }
    if (!initialDataRef.current) {
      initialDataRef.current = currentData;
    }
  }, [estimateData, lineItems]);

  // Auto-save logic with debouncing
  const saveDraft = useCallback(async () => {
    if (!enabled || !hasMeaningfulData()) return;

    setIsSaving(true);
    try {
      if (draftId) {
        // Update existing draft
        const { error: updateError } = await supabase
          .from("estimates")
          .update({
            customer_id: estimateData.customer_id || null,
            customer_name: estimateData.customer_name || "Draft",
            project_id: estimateData.project_id || null,
            project_name: estimateData.project_name || null,
            subtotal: estimateData.subtotal,
            tax_rate: estimateData.tax_rate,
            tax_amount: estimateData.tax_amount,
            total: estimateData.total,
            notes: estimateData.notes || null,
            valid_until: estimateData.valid_until,
            default_pricing_type: estimateData.default_pricing_type,
            status: "draft",
          })
          .eq("id", draftId);

        if (updateError) throw updateError;

        // Delete existing line items and insert new ones
        await supabase
          .from("estimate_line_items")
          .delete()
          .eq("estimate_id", draftId);

        if (lineItems.length > 0) {
          const lineItemsToInsert = lineItems
            .filter((item) => item.description.trim() || item.unit_price > 0)
            .map((item, index) => ({
              estimate_id: draftId,
              product_id: item.product_id || null,
              description: item.description || "Draft item",
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0,
              markup: item.markup || 0,
              pricing_type: item.pricing_type || "margin",
              is_taxable: item.is_taxable ?? true,
              total: item.total || 0,
              sort_order: index,
            }));

          if (lineItemsToInsert.length > 0) {
            await supabase
              .from("estimate_line_items")
              .insert(lineItemsToInsert);
          }
        }
      } else {
        // Create new draft
        const { data: newDraft, error: insertError } = await supabase
          .from("estimates")
          .insert({
            number: estimateData.number,
            customer_id: estimateData.customer_id || null,
            customer_name: estimateData.customer_name || "Draft",
            project_id: estimateData.project_id || null,
            project_name: estimateData.project_name || null,
            subtotal: estimateData.subtotal,
            tax_rate: estimateData.tax_rate,
            tax_amount: estimateData.tax_amount,
            total: estimateData.total,
            notes: estimateData.notes || null,
            valid_until: estimateData.valid_until,
            default_pricing_type: estimateData.default_pricing_type,
            status: "draft",
          })
          .select()
          .single();

        if (insertError) throw insertError;

        setDraftId(newDraft.id);

        // Update URL with draft ID (without triggering navigation)
        window.history.replaceState(
          null,
          "",
          `/estimates/new?draft=${newDraft.id}`
        );

        // Insert line items
        if (lineItems.length > 0) {
          const lineItemsToInsert = lineItems
            .filter((item) => item.description.trim() || item.unit_price > 0)
            .map((item, index) => ({
              estimate_id: newDraft.id,
              product_id: item.product_id || null,
              description: item.description || "Draft item",
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0,
              markup: item.markup || 0,
              pricing_type: item.pricing_type || "margin",
              is_taxable: item.is_taxable ?? true,
              total: item.total || 0,
              sort_order: index,
            }));

          if (lineItemsToInsert.length > 0) {
            await supabase
              .from("estimate_line_items")
              .insert(lineItemsToInsert);
          }
        }
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
    } catch (error) {
      console.error("Failed to save draft:", error);
    } finally {
      setIsSaving(false);
    }
  }, [
    enabled,
    hasMeaningfulData,
    draftId,
    estimateData,
    lineItems,
    queryClient,
  ]);

  // Debounced auto-save
  useEffect(() => {
    if (!enabled || !hasUnsavedChanges) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveDraft();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, hasUnsavedChanges, saveDraft, debounceMs]);

  // Save on unmount/navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && hasMeaningfulData()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Save draft on component unmount if there are unsaved changes
      if (hasUnsavedChanges && hasMeaningfulData()) {
        saveDraft();
      }
    };
  }, [hasUnsavedChanges, hasMeaningfulData, saveDraft]);

  // Delete draft after successful submission
  const clearDraft = useCallback(async () => {
    if (draftId) {
      // The estimate is now saved, no need to delete
      setDraftId(null);
      setLastSaved(null);
      setHasUnsavedChanges(false);
    }
  }, [draftId]);

  return {
    draftId,
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    saveDraft,
    clearDraft,
    setDraftId,
  };
}
