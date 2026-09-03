// Bulk workforce outreach: invites selected applicants to a job posting (or sends
// a free-text blast) over SMS and/or email. Admin/manager JWT required.
//
// Each recipient gets a per-person quick_apply_invites row so we can measure the
// funnel (invited -> opened -> applied). The apply link points at the public
// posting with ?inv=<invite_token> so the form can prefill and skip the express gate.
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

function toE164(phone: string): string {
  let to = phone.replace(/[^\d+]/g, "");
  if (to.startsWith("+")) return to;
  if (to.length === 10) return "+1" + to;
  if (to.length === 11 && to.startsWith("1")) return "+" + to;
  return "+" + to;
}

interface Options {
  exclude_applied?: boolean;
  exclude_do_not_rehire?: boolean;
  exclude_recently_invited?: boolean;
  sms_consent_only?: boolean;
}

interface Body {
  job_posting_id?: string | null;
  applicant_ids: string[];
  channel: "sms" | "email" | "both";
  sms_text?: string;
  email_subject?: string;
  email_body?: string;
  options?: Options;
  dry_run?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const service = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authError } = await service.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await service.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => ["admin", "manager"].includes(r.role))) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = (await req.json()) as Body;
    const ids = [...new Set(body?.applicant_ids ?? [])];
    if (!ids.length) return json({ error: "applicant_ids is required" }, 400);
    if (ids.length > 500) return json({ error: "Too many recipients (max 500)" }, 400);
    const channel = body.channel ?? "sms";
    const opts: Options = {
      exclude_applied: true,
      exclude_do_not_rehire: true,
      exclude_recently_invited: true,
      sms_consent_only: true,
      ...(body.options ?? {}),
    };

    // ---- Posting context (optional: free-text blasts have no posting) ----
    let posting: any = null;
    let publicToken: string | null = null;
    let facts = { title: "", pay: "", start: "", location: "" };
    if (body.job_posting_id) {
      const { data: p } = await service
        .from("job_postings")
        .select(
          "id, public_token, is_open, project_task_orders ( title, start_at, location_address, task_order_positions ( advertised_pay_rate, show_pay_publicly ) )"
        )
        .eq("id", body.job_posting_id)
        .maybeSingle();
      if (!p) return json({ error: "Posting not found" }, 404);
      posting = p;
      publicToken = p.public_token as string;
      const to = (p as any).project_task_orders ?? {};
      const rates = (to.task_order_positions ?? [])
        .filter((x: any) => x.show_pay_publicly !== false && x.advertised_pay_rate)
        .map((x: any) => Number(x.advertised_pay_rate));
      facts = {
        title: to.title ?? "",
        pay: rates.length
          ? rates.length > 1 && Math.min(...rates) !== Math.max(...rates)
            ? `$${Math.min(...rates)}–$${Math.max(...rates)}/hr`
            : `$${rates[0]}/hr`
          : "",
        start: to.start_at ? new Date(to.start_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
        location: to.location_address ?? "",
      };
    }

    // ---- Recipients ----
    const { data: applicants, error: appErr } = await service
      .from("applicants")
      .select("id, first_name, last_name, phone, email, do_not_rehire, sms_opted_out")
      .in("id", ids);
    if (appErr) return json({ error: appErr.message }, 500);

    const appliedSet = new Set<string>();
    if (body.job_posting_id && opts.exclude_applied) {
      const { data: apps } = await service
        .from("applications")
        .select("applicant_id")
        .eq("job_posting_id", body.job_posting_id)
        .in("applicant_id", ids);
      for (const a of apps ?? []) if (a.applicant_id) appliedSet.add(a.applicant_id);
    }

    const recentlyInvited = new Set<string>();
    if (body.job_posting_id && opts.exclude_recently_invited) {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { data: inv } = await service
        .from("quick_apply_invites")
        .select("applicant_id")
        .eq("job_posting_id", body.job_posting_id)
        .in("applicant_id", ids)
        .gte("sent_at", since);
      for (const i of inv ?? []) if (i.applicant_id) recentlyInvited.add(i.applicant_id);
    }

    const consented = new Set<string>();
    if (opts.sms_consent_only) {
      const { data: consents } = await service
        .from("applications")
        .select("applicant_id, sms_consent")
        .in("applicant_id", ids)
        .eq("sms_consent", true);
      for (const c of consents ?? []) if (c.applicant_id) consented.add(c.applicant_id);
    }

    type Result = {
      applicant_id: string;
      name: string;
      phone: string | null;
      email: string | null;
      sms: "sent" | "failed" | "skipped";
      email_status: "sent" | "failed" | "skipped";
      reason?: string;
      twilio_sid?: string;
    };
    const results: Result[] = [];
    const eligible: any[] = [];

    for (const a of applicants ?? []) {
      const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
      const base: Result = {
        applicant_id: a.id, name, phone: a.phone, email: a.email,
        sms: "skipped", email_status: "skipped",
      };
      if (opts.exclude_do_not_rehire && a.do_not_rehire) {
        results.push({ ...base, reason: "do not rehire" });
        continue;
      }
      if (a.sms_opted_out && channel === "sms") {
        results.push({ ...base, reason: "opted out of SMS" });
        continue;
      }
      if (appliedSet.has(a.id)) { results.push({ ...base, reason: "already applied" }); continue; }
      if (recentlyInvited.has(a.id)) { results.push({ ...base, reason: "invited in last 7 days" }); continue; }
      if (opts.sms_consent_only && !consented.has(a.id) && channel !== "email") {
        results.push({ ...base, reason: "no SMS consent" });
        continue;
      }
      eligible.push(a);
    }

    if (body.dry_run) {
      return json({
        dry_run: true,
        eligible: eligible.length,
        skipped: results.length,
        results: [
          ...eligible.map((a) => ({
            applicant_id: a.id,
            name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim(),
            phone: a.phone, email: a.email, sms: "pending", email_status: "pending",
          })),
          ...results,
        ],
      });
    }

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_PHONE_NUMBER");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const wantsSms = channel === "sms" || channel === "both";
    const wantsEmail = channel === "email" || channel === "both";
    if (wantsSms && (!sid || !twToken || !from)) return json({ error: "Twilio not configured" }, 500);

    const expiresAt = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

    for (const a of eligible) {
      const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
      const result: Result = {
        applicant_id: a.id, name, phone: a.phone, email: a.email,
        sms: "skipped", email_status: "skipped",
      };

      // Per-recipient invite row + link
      let link = "";
      if (body.job_posting_id && publicToken) {
        const inviteToken = crypto.randomUUID().replace(/-/g, "");
        const { error: invErr } = await service.from("quick_apply_invites").insert({
          applicant_id: a.id,
          job_posting_id: body.job_posting_id,
          token: inviteToken,
          phone: a.phone,
          message: body.sms_text ?? null,
          created_by: user.id,
          sent_at: new Date().toISOString(),
          expires_at: expiresAt,
        });
        link = invErr
          ? `https://fairfieldrg.com/apply/${publicToken}`
          : `https://fairfieldrg.com/apply/${publicToken}?inv=${inviteToken}`;
      }

      const fill = (t: string) =>
        (t ?? "")
          .replaceAll("{first_name}", a.first_name ?? "")
          .replaceAll("{last_name}", a.last_name ?? "")
          .replaceAll("{title}", facts.title)
          .replaceAll("{pay}", facts.pay)
          .replaceAll("{start}", facts.start)
          .replaceAll("{location}", facts.location)
          .replaceAll("{link}", link);

      // ---- SMS ----
      if (wantsSms && body.sms_text) {
        if (!digits(a.phone)) {
          result.sms = "skipped";
          result.reason = "no phone";
        } else {
          const to = toE164(a.phone);
          const text = fill(body.sms_text);
          try {
            const res = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  Authorization: `Basic ${btoa(`${sid}:${twToken}`)}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ To: to, From: from!, Body: text }),
              }
            );
            const data = await res.json();
            if (!res.ok) {
              result.sms = "failed";
              result.reason = data?.message || `HTTP ${res.status}`;
              if (data?.code === 21610) {
                await service.from("applicants").update({ sms_opted_out: true }).eq("id", a.id);
                result.reason = "opted out (21610)";
              }
            } else {
              result.sms = "sent";
              result.twilio_sid = data?.sid;
            }
          } catch (e) {
            result.sms = "failed";
            result.reason = String(e);
          }
          await service.from("applicant_messages").insert({
            applicant_id: a.id,
            job_posting_id: body.job_posting_id ?? null,
            channel: "sms",
            body: text,
            status: result.sms,
            error: result.sms === "failed" ? result.reason : null,
            twilio_sid: result.twilio_sid ?? null,
            created_by: user.id,
          });
        }
      }

      // ---- Email (silently skipped when Resend isn't configured) ----
      if (wantsEmail && resendKey && a.email && body.email_body) {
        const subject = fill(body.email_subject ?? "");
        const html = fill(body.email_body).replace(/\n/g, "<br/>");
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Fairfield Response Group <careers@fairfieldrg.com>",
              to: [a.email],
              subject,
              html,
            }),
          });
          result.email_status = res.ok ? "sent" : "failed";
          if (!res.ok) result.reason = `email HTTP ${res.status}`;
        } catch (e) {
          result.email_status = "failed";
          result.reason = String(e);
        }
        await service.from("applicant_messages").insert({
          applicant_id: a.id,
          job_posting_id: body.job_posting_id ?? null,
          channel: "email",
          subject,
          body: fill(body.email_body),
          status: result.email_status,
          error: result.email_status === "failed" ? result.reason : null,
          created_by: user.id,
        });
      }

      results.push(result);
      await new Promise((r) => setTimeout(r, 250));
    }

    return json({
      sent: results.filter((r) => r.sms === "sent" || r.email_status === "sent").length,
      failed: results.filter((r) => r.sms === "failed" || r.email_status === "failed").length,
      skipped: results.filter((r) => r.sms === "skipped" && r.email_status === "skipped").length,
      results,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
