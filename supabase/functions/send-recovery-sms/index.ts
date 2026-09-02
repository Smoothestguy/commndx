// Abandoned applicant recovery: texts people who started but never submitted an
// application for a posting (partial rows live in application_attempts).
// Admins/managers only. One send per attempt row is enforced server-side via
// recovery_sms_sent_at so a repeat call can never re-text anyone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
const mask = (p: string) => `***-***-${p.slice(-4)}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user }, error: authError } = await service.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (!roles?.some((r: any) => ["admin", "manager"].includes(r.role))) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const jobPostingId: string | undefined = body?.job_posting_id;
    const dryRun: boolean = body?.dry_run === true;
    if (!jobPostingId) return json({ error: "job_posting_id is required" }, 400);

    // Posting + apply link
    const { data: posting, error: postErr } = await service
      .from("job_postings")
      .select("id, public_token, project_task_orders ( title )")
      .eq("id", jobPostingId)
      .maybeSingle();
    if (postErr || !posting) return json({ error: "Posting not found" }, 404);

    const applyLink = `https://fairfieldrg.com/apply/${posting.public_token}`;

    // Existing submitted applications for this posting (phone/email of applicant)
    const { data: submitted } = await service
      .from("applications")
      .select("applicants ( phone, email )")
      .eq("job_posting_id", jobPostingId);

    const submittedPhones = new Set<string>();
    const submittedEmails = new Set<string>();
    for (const row of submitted ?? []) {
      const a: any = (row as any).applicants;
      if (!a) continue;
      const d = digits(a.phone);
      if (d) submittedPhones.add(d.slice(-10));
      if (a.email) submittedEmails.add(String(a.email).toLowerCase());
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: attempts, error: attErr } = await service
      .from("application_attempts")
      .select("id, first_name, last_name, phone, email, updated_at, recovery_sms_sent_at")
      .eq("job_posting_id", jobPostingId)
      .is("recovery_sms_sent_at", null)
      .not("first_name", "is", null)
      .gte("updated_at", sevenDaysAgo)
      .order("updated_at", { ascending: false });
    if (attErr) return json({ error: attErr.message }, 500);

    // Dedupe by 10-digit phone, keeping most recently updated row (query is ordered desc)
    const byPhone = new Map<string, { first_name: string; phone: string; email: string | null }>();
    for (const a of attempts ?? []) {
      const d = digits(a.phone);
      if (d.length !== 10) continue;
      const email = a.email ? String(a.email).toLowerCase() : null;
      if (submittedPhones.has(d)) continue;
      if (email && submittedEmails.has(email)) continue;
      if (byPhone.has(d)) continue;
      byPhone.set(d, { first_name: a.first_name as string, phone: d, email });
    }

    const recipients = [...byPhone.values()];

    if (dryRun) {
      return json({
        dry_run: true,
        count: recipients.length,
        apply_link: applyLink,
        recipients: recipients.map((r) => ({
          first_name: r.first_name,
          phone_masked: mask(r.phone),
          email: r.email,
        })),
      });
    }

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!sid || !twToken || !from) return json({ error: "Twilio not configured" }, 500);

    const results: Array<Record<string, unknown>> = [];

    for (const r of recipients) {
      const message =
        `Fairfield Response Group: ${r.first_name}, your Shipyard Crew application didn't go through — that was our error and it's fixed. ` +
        `Please finish here (2 min) / Tu solicitud no se completó por un error nuestro y ya está corregido. Termínala aquí: ${applyLink} ` +
        `Reply STOP to opt out.`;

      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${sid}:${twToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: `+1${r.phone}`, From: from, Body: message }),
          }
        );
        const data = await res.json();

        if (res.ok) {
          // Mark every attempt row for this posting sharing the phone as sent.
          const ids = (attempts ?? [])
            .filter((a) => digits(a.phone) === r.phone)
            .map((a) => a.id);
          if (ids.length) {
            await service
              .from("application_attempts")
              .update({
                recovery_sms_sent_at: new Date().toISOString(),
                recovery_sms_sid: data.sid,
              })
              .in("id", ids);
          }
          results.push({
            first_name: r.first_name,
            phone_masked: mask(r.phone),
            ok: true,
            sid: data.sid,
          });
        } else {
          results.push({
            first_name: r.first_name,
            phone_masked: mask(r.phone),
            ok: false,
            error: data?.message || `HTTP ${res.status}`,
          });
        }
      } catch (e) {
        results.push({
          first_name: r.first_name,
          phone_masked: mask(r.phone),
          ok: false,
          error: String(e),
        });
      }
    }

    return json({
      dry_run: false,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
