import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ContactReviewItem {
  id: string; source: string; reason: string;
  submitted_first_name: string | null; submitted_last_name: string | null; submitted_email: string | null; submitted_phone: string | null;
  matched_entity_type: "applicant" | "personnel"; matched_entity_id: string; created_at: string;
  matched?: { name: string; email: string | null; phone: string | null } | null;
}
export interface DuplicateGroup {
  reason: "same_email" | "same_phone" | "similar_name"; match_key: string;
  personnel: { id: string; name: string; personnel_number: string | null; email: string | null; phone: string | null; status: string; created_at: string }[];
}

export function useOpenContactReviews(enabled = true) {
  return useQuery({
    queryKey: ["contact-review-items", "open"], enabled,
    queryFn: async (): Promise<ContactReviewItem[]> => {
      const { data, error } = await supabase.from("contact_review_items").select("*").eq("status", "open").order("created_at", { ascending: false });
      if (error) throw error;
      const items = (data ?? []) as ContactReviewItem[];
      const appIds = items.filter((i) => i.matched_entity_type === "applicant").map((i) => i.matched_entity_id);
      const perIds = items.filter((i) => i.matched_entity_type === "personnel").map((i) => i.matched_entity_id);
      const [apps, pers] = await Promise.all([
        appIds.length ? supabase.from("applicants").select("id, first_name, last_name, email, phone").in("id", appIds) : Promise.resolve({ data: [] as any[] }),
        perIds.length ? supabase.from("personnel").select("id, first_name, last_name, email, phone").in("id", perIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const byId = new Map<string, any>([...(apps.data ?? []), ...(pers.data ?? [])].map((r: any) => [r.id, r]));
      return items.map((i) => { const r = byId.get(i.matched_entity_id); return { ...i, matched: r ? { name: `${r.first_name} ${r.last_name}`, email: r.email, phone: r.phone } : null }; });
    },
  });
}

export function useResolveContactReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; decision: "update_contact" | "keep_existing" | "different_person"; notes?: string }) => {
      const { error } = await supabase.rpc("resolve_contact_review", { p_item: v.id, p_decision: v.decision, p_notes: v.notes ?? null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contact-review-items"] }); toast.success("Decision saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePersonnelDuplicateGroups(enabled = true) {
  return useQuery({
    queryKey: ["personnel-duplicate-groups"], enabled,
    queryFn: async (): Promise<DuplicateGroup[]> => {
      const { data, error } = await supabase.rpc("personnel_duplicate_groups");
      if (error) throw error;
      return (data ?? []) as unknown as DuplicateGroup[];
    },
  });
}

export function useDismissDuplicateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { ids: string[]; reason?: string }) => {
      const { error } = await supabase.rpc("dismiss_duplicate_group", { p_ids: v.ids, p_reason: v.reason ?? null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["personnel-duplicate-groups"] }); toast.success("Marked as not duplicates"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
