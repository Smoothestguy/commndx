// Sends re-apply SMS to a curated list of past workers (applicants + personnel).
// Admins/managers only. Reuses the same Twilio env used by invite-applicants-sms.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  name: string;
  phone: string;
  applicantId?: string | null;
  personnelId?: string | null;
}

interface Req {
  recipients: Recipient[];
  message: string; // may include {name} and {link}
  link: string;
}

interface Result {
  name: string;
  phone: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(url, key);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await client.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await client.from("user_roles").select("role").eq("user_id", user.id);
    const allowed = roles?.some((r: any) => ["admin", "manager"].includes(r.role));
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Req;
    if (!body?.recipients?.length || !body?.message || !body?.link) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.recipients.length > 100) {
      return new Response(JSON.stringify({ error: "Too many recipients (max 100)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authTok = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!sid || !authTok || !from) {
      return new Response(JSON.stringify({ error: "Twilio not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Result[] = [];
    for (const r of body.recipients) {
      if (!r.phone) {
        results.push({ name: r.name, phone: "", status: "skipped", error: "no phone" });
        continue;
      }
      let to = r.phone.replace(/[^\d+]/g, "");
      if (!to.startsWith("+")) {
        if (to.length === 10) to = "+1" + to;
        else if (to.length === 11 && to.startsWith("1")) to = "+" + to;
        else to = "+" + to;
      }
      const finalMsg = body.message
        .replaceAll("{name}", r.name || "")
        .replaceAll("{link}", body.link);
      try {
        const twRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${sid}:${authTok}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: to, From: from, Body: finalMsg }),
          }
        );
        const tw = await twRes.json();
        if (!twRes.ok) {
          results.push({ name: r.name, phone: to, status: "failed", error: tw?.message || `HTTP ${twRes.status}` });
        } else {
          results.push({ name: r.name, phone: to, status: "sent" });
        }
      } catch (e) {
        results.push({ name: r.name, phone: to, status: "failed", error: String(e) });
      }
    }

    const sent = results.filter(r => r.status === "sent").length;
    const failed = results.filter(r => r.status === "failed").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    return new Response(JSON.stringify({ sent, failed, skipped, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
