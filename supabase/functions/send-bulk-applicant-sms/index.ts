// Bulk SMS blast to applicants of a job posting.
// Authorized by a single-use blast_token (table sms_blast_tokens, service-role only),
// so it can be invoked with the anon key. Twilio pattern mirrors
// send-application-sms-confirmation (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const hasPlus = raw.trim().startsWith("+");
  const d = raw.replace(/\D/g, "");
  if (hasPlus && d.length >= 10 && d.length <= 15) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

const mask = (p: string) => p.slice(0, -4).replace(/\d/g, "•") + p.slice(-4);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const blast_token = typeof body?.blast_token === "string" ? body.blast_token.trim() : "";
    const job_posting_id = typeof body?.job_posting_id === "string" ? body.job_posting_id : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const consented_only = body?.consented_only !== false;
    const dry_run = body?.dry_run === true;

    if (!blast_token || blast_token.length > 256) return json({ error: "blast_token required" }, 400);
    if (!UUID_RE.test(job_posting_id)) return json({ error: "Valid job_posting_id required" }, 400);
    if (!message || message.length > 1600) return json({ error: "message required (max 1600 chars)" }, 400);

    const client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Validate token (read-only first so dry runs don't consume it)
    const { data: tokenRow } = await client
      .from("sms_blast_tokens")
      .select("id, posting_id, max_recipients, used_at")
      .eq("token", blast_token)
      .maybeSingle();
    if (!tokenRow || tokenRow.used_at) return json({ error: "Invalid or used token" }, 403);
    if (tokenRow.posting_id && tokenRow.posting_id !== job_posting_id) {
      return json({ error: "Token not valid for this posting" }, 403);
    }

    // Recipients
    const { data: apps, error: appsErr } = await client
      .from("applications")
      .select("applicant_id, sms_consent, status, applicants!inner(id, phone)")
      .eq("job_posting_id", job_posting_id)
      .neq("status", "rejected");
    if (appsErr) return json({ error: "Recipient query failed: " + appsErr.message }, 500);

    const byApplicant = new Map<string, { phone: string | null; consent: boolean }>();
    for (const a of (apps ?? []) as any[]) {
      const ap = Array.isArray(a.applicants) ? a.applicants[0] : a.applicants;
      if (!ap) continue;
      const prev = byApplicant.get(ap.id);
      byApplicant.set(ap.id, {
        phone: ap.phone ?? prev?.phone ?? null,
        consent: (prev?.consent ?? false) || a.sms_consent === true,
      });
    }

    let skipped_no_phone = 0;
    const seenPhones = new Set<string>();
    let recipients: { applicant_id: string; phone: string }[] = [];
    for (const [applicant_id, v] of byApplicant) {
      if (consented_only && !v.consent) continue;
      const phone = normalizePhone(v.phone);
      if (!phone) { skipped_no_phone++; continue; }
      if (seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      recipients.push({ applicant_id, phone });
    }
    if (tokenRow.max_recipients != null && tokenRow.max_recipients >= 0) {
      recipients = recipients.slice(0, tokenRow.max_recipients);
    }

    if (dry_run) {
      return json({
        recipients: recipients.length,
        skipped_no_phone,
        sample: recipients.slice(0, 5).map((r) => mask(r.phone)),
      });
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!accountSid || !authToken || !twilioPhone) {
      return json({ error: "SMS service not configured" }, 500);
    }

    // Atomic claim BEFORE sending
    const { data: claimed, error: claimErr } = await client
      .from("sms_blast_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRow.id)
      .is("used_at", null)
      .select("id");
    if (claimErr || !claimed || claimed.length === 0) {
      return json({ error: "Invalid or used token" }, 403);
    }

    const delay = recipients.length > 300 ? 150 : 200;
    let sent = 0, failed = 0;
    for (const r of recipients) {
      let status = "failed", error: string | null = null, sid: string | null = null;
      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: r.phone, From: twilioPhone, Body: message }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok) { status = "sent"; sid = data.sid ?? null; sent++; }
        else { error = data.message || `HTTP ${res.status}`; failed++; }
      } catch (e) {
        error = String(e); failed++;
      }
      const { error: logErr } = await client.from("applicant_messages").insert({
        applicant_id: r.applicant_id,
        job_posting_id,
        channel: "sms",
        body: message,
        status,
        error,
        twilio_sid: sid,
        created_by: null,
      });
      if (logErr) console.error("[bulk-applicant-sms] log insert failed", logErr.message);
      await sleep(delay);
    }

    return json({ sent, failed, skipped_no_phone, total_recipients: recipients.length });
  } catch (e: any) {
    console.error("[bulk-applicant-sms] error", e);
    return json({ error: e?.message || "Internal server error" }, 500);
  }
});
