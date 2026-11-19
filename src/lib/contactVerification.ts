import { supabase } from "@/integrations/supabase/client";

export type ContactType = "email" | "phone";
export type VerificationContext =
  | { kind: "onboarding"; token: string }
  | { kind: "registration"; invite_token?: string }
  | { kind: "apply"; posting_id: string; posting_token?: string; agency_token?: string };

export type SendResult = { sent: true; verification_id: string } | { sent: false; reason: "rate_limited" | "unavailable" | "error" };
export type VerifyResult = { verified: true; proof_id: string } | { verified: false; reason: string; attempts_left?: number };

export const normalizeEmail = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
export const normalizePhone = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "").slice(-10);

/** A send failure (service down, not configured, network) never blocks the worker — the UI offers "I can't get the code". */
export async function sendContactCode(context: VerificationContext, contact_type: ContactType, contact: string, lang: "en" | "es" = "en"): Promise<SendResult> {
  try {
    const { data, error } = await supabase.functions.invoke("contact-verification", { body: { action: "send", context, contact_type, contact, lang } });
    if (error || !data) return { sent: false, reason: "error" };
    return data as SendResult;
  } catch { return { sent: false, reason: "error" }; }
}

export async function verifyContactCode(verification_id: string, code: string): Promise<VerifyResult> {
  try {
    const { data, error } = await supabase.functions.invoke("contact-verification", { body: { action: "verify", verification_id, code } });
    if (error || !data) return { verified: false, reason: "error" };
    return data as VerifyResult;
  } catch { return { verified: false, reason: "error" }; }
}

/** Which contacts the worker must confirm: the link's own channel is proven when unchanged. */
export function contactsNeedingCode(linkChannel: "email" | "sms" | null, original: { email?: string | null; phone?: string | null }, current: { email?: string | null; phone?: string | null }) {
  const emailProven = linkChannel === "email" && !!normalizeEmail(current.email) && normalizeEmail(current.email) === normalizeEmail(original.email);
  const phoneProven = linkChannel === "sms" && !!normalizePhone(current.phone) && normalizePhone(current.phone) === normalizePhone(original.phone);
  return { email: !emailProven && !!normalizeEmail(current.email), phone: !phoneProven && normalizePhone(current.phone).length === 10, emailProven, phoneProven };
}
