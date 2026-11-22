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
  /** Set when the database guard refused the insert; only an admin override can proceed. */
  blocked?: boolean;
}

export const REASON_LABEL: Record<MatchReason, string> = { same_email: "same email", same_phone: "same phone", similar_name: "similar name" };

/** Mirrors the database insert guard: an existing person's same real email or same phone blocks (admin override with reason). */
export const matchesBlock = (m: ContactMatch[]) => m.some((x) => x.blocked || x.entity_type === "personnel" && (x.reasons.includes("same_phone") || (x.reasons.includes("same_email") && !(x.email ?? "").endsWith(".invalid"))));

/** Recognizes the database duplicate guard (SQLSTATE DP001) and returns the matched existing person. */
export function parseDuplicateError(err: unknown): ContactMatch | null {
  const e = err as { code?: string; details?: string; message?: string; match?: Record<string, string> } | null;
  if (!e || (e.code !== "DP001" && !String(e.message ?? "").startsWith("Duplicate: matches"))) return null;
  let d: Record<string, string> | null = e.match ?? null;
  if (!d) { try { d = JSON.parse(e.details ?? "null"); } catch { d = null; } }
  if (!d?.personnel_id) return null;
  const reason = (d.reason === "same_name" ? "similar_name" : d.reason) as MatchReason;
  return { entity_type: "personnel", entity_id: d.personnel_id, full_name: d.full_name ?? "", ref_number: d.personnel_number ?? null, email: null, phone: null, created_at: "", reasons: [reason], blocked: true };
}

/** Admin-only insert past the duplicate guard; the server requires a reason and writes the audit entry. */
export async function createPersonnelOverride(payload: Record<string, unknown>, reason: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_personnel_override", { p_payload: payload as never, p_reason: reason });
  if (error) throw error;
  return data as string;
}

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
