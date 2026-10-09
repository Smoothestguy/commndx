// Texts an applicant a one-time link (/photo/:token) to upload a badge photo.
// Staff-only (admin/manager/user). Token row is created with the service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authErr } = await service.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await service.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => ["admin", "manager", "user"].includes(r.role))) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const applicantId = body?.applicant_id;
    if (typeof applicantId !== "string" || !UUID.test(applicantId)) return json({ error: "applicant_id is required" }, 400);

    const { data: applicant } = await service.from("applicants").select("id, first_name, phone").eq("id", applicantId).maybeSingle();
    if (!applicant) return json({ error: "Applicant not found" }, 404);
    const d = String(applicant.phone ?? "").replace(/\D/g, "");
    const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
    if (ten.length !== 10) return json({ error: "Applicant has no valid phone" }, 400);

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!sid || !twToken || !from) return json({ error: "Twilio not configured" }, 500);

    const { data: tok, error: tokErr } = await service
      .from("photo_request_tokens").insert({ applicant_id: applicantId, created_by: user.id }).select("token").single();
    if (tokErr || !tok) return json({ error: tokErr?.message ?? "Token create failed" }, 500);

    const link = `https://fairfieldrg.com/photo/${tok.token}`;
    const message = `FRG: We need a photo for your badge, ${applicant.first_name ?? "there"}. Takes 10 seconds: ${link}`;

    let status = "sent", error: string | null = null, twilioSid: string | null = null;
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`${sid}:${twToken}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: `+1${ten}`, From: from, Body: message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { status = "failed"; error = data?.message ?? `HTTP ${res.status}`; }
      else twilioSid = data?.sid ?? null;
    } catch (e) { status = "failed"; error = String(e); }

    const { error: logErr } = await service.from("applicant_messages").insert({
      applicant_id: applicantId, channel: "sms", body: message, status, error, twilio_sid: twilioSid, created_by: user.id,
    });
    if (logErr) console.error("[photo-request] log failed", logErr.message);

    if (status !== "sent") return json({ sent: false, error }, 502);
    return json({ sent: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
