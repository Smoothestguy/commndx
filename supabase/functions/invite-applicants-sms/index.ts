// Bulk-invites previously-applied applicants via SMS with a custom message and apply link.
// Only admins/managers may invoke.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  applicantIds: string[];
  message: string; // may include {link} placeholder
  postingId: string;
  useQuickApply?: boolean; // when true, generates per-applicant quick-apply tokens
}

interface RecipientResult {
  applicantId: string;
  name: string;
  phone: string | null;
  status: "sent" | "failed" | "skipped";
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowed = roles?.some((r: any) => ["admin", "manager"].includes(r.role));
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as InviteRequest;
    if (!body?.applicantIds?.length || !body?.message || !body?.postingId) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.applicantIds.length > 500) {
      return new Response(JSON.stringify({ error: "Too many recipients (max 500)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get posting for public link
    const { data: posting, error: postErr } = await client
      .from("job_postings")
      .select("id, public_token, is_open")
      .eq("id", body.postingId)
      .maybeSingle();
    if (postErr || !posting) {
      return new Response(JSON.stringify({ error: "Posting not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || "https://commndx.com";
    const fallbackLink = `${origin}/apply/${posting.public_token}`;

    const { data: applicants } = await client
      .from("applicants")
      .select("id, first_name, last_name, phone")
      .in("id", body.applicantIds);

    // If quick apply requested, generate per-applicant tokens in one call
    let tokenMap = new Map<string, string>();
    let alreadyAppliedSet = new Set<string>();
    if (body.useQuickApply) {
      const { data: rows, error: genErr } = await client.rpc("generate_quick_apply_invites", {
        _applicant_ids: body.applicantIds,
        _job_posting_id: body.postingId,
        _message: body.message,
        _created_by: user.id,
        _expires_days: 14,
      });
      if (genErr) {
        return new Response(JSON.stringify({ error: "Failed to generate invites: " + genErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      for (const r of rows ?? []) {
        if (r.already_applied) alreadyAppliedSet.add(r.applicant_id);
        else if (r.token) tokenMap.set(r.applicant_id, r.token);
      }
    }

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!sid || !authToken || !from) {
      return new Response(JSON.stringify({ error: "Twilio not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: RecipientResult[] = [];
    for (const a of applicants ?? []) {
      const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
      if (alreadyAppliedSet.has(a.id)) {
        results.push({ applicantId: a.id, name, phone: a.phone, status: "skipped", error: "already applied" });
        continue;
      }
      if (!a.phone) {
        results.push({ applicantId: a.id, name, phone: null, status: "skipped", error: "no phone" });
        continue;
      }
      let to = a.phone.replace(/[^\d+]/g, "");
      if (!to.startsWith("+")) {
        if (to.length === 10) to = "+1" + to;
        else if (to.length === 11 && to.startsWith("1")) to = "+" + to;
        else to = "+" + to;
      }

      const perLink = body.useQuickApply && tokenMap.has(a.id)
        ? `${origin}/quick-apply/${tokenMap.get(a.id)}`
        : fallbackLink;

      const personalized = body.message
        .replaceAll("{link}", perLink)
        .replaceAll("{first_name}", a.first_name ?? "")
        .replaceAll("{last_name}", a.last_name ?? "");
      const finalMsg = personalized.includes(perLink) ? personalized : `${personalized}\n${perLink}`;


      try {
        const twRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${sid}:${authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: to, From: from, Body: finalMsg }),
          }
        );
        const twData = await twRes.json();
        if (!twRes.ok) {
          results.push({
            applicantId: a.id,
            name,
            phone: to,
            status: "failed",
            error: twData?.message || `HTTP ${twRes.status}`,
          });
        } else {
          results.push({ applicantId: a.id, name, phone: to, status: "sent" });
        }
      } catch (e) {
        results.push({
          applicantId: a.id,
          name,
          phone: to,
          status: "failed",
          error: String(e),
        });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    return new Response(
      JSON.stringify({ sent, failed, skipped, link: fallbackLink, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
