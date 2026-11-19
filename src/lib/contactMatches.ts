import { supabase } from "@/integrations/supabase/client";

export type MatchReason = "same_email" | "same_phone" | "similar_name";
export interface ContactMatch {
  entity_type: "personnel" | "applicant";
  entity_id: string;
  full_name: string;
  ref_number: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  reasons: MatchReason[];
}

export const REASON_LABEL: Record<MatchReason, string> = { same_email: "same email", same_phone: "same phone", similar_name: "similar name" };

/** Same email blocks (admin override with reason); same phone / similar name only warn. */
export const matchesBlock = (m: ContactMatch[]) => m.some((x) => x.reasons.includes("same_email"));

export async function findContactMatches(input: { first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null }): Promise<ContactMatch[]> {
  const { data, error } = await supabase.rpc("find_contact_matches", {
    p_first_name: input.first_name ?? "", p_last_name: input.last_name ?? "", p_email: input.email ?? "", p_phone: input.phone ?? "",
  });
  if (error) throw error;
  return (data ?? []) as ContactMatch[];
}

export async function logCreateAnyway(source: string, input: { first_name?: string; last_name?: string; email?: string | null; phone?: string | null }, matches: ContactMatch[], reason: string | null, createdId?: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      user_id: user?.id ?? null, user_email: user?.email ?? "", action_type: "duplicate_create_anyway", resource_type: "personnel",
      resource_id: createdId ?? null, success: true,
      metadata: { source, reason, submitted: input, matches: matches.map((m) => ({ type: m.entity_type, id: m.entity_id, reasons: m.reasons })) },
    });
  } catch (e) { console.error("Create-anyway audit failed", e); }
}
