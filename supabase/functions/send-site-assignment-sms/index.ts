// Texts site assignment details + a personal self check-in link (/punch/:token) to personnel.
// Staff-only (admin/manager/user). Creates one site_checkin_tokens row per person.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { locationZone,localStamp } from '../_shared/locationTime.ts';
import { sendJoinApproval } from '../_shared/joinApproval.ts';

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
    const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ error: 'Service unavailable' }, 503);
    const service = createClient(url, key);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authErr } = await service.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await service.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => ["admin", "manager", "user"].includes(r.role))) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    if (body?.action === 'join_approval') return sendJoinApproval(service, user.id, body);
    const { location_id, personnel_ids, report_at, include = {}, custom_note } = body ?? {};
    if (typeof location_id !== "string" || !UUID.test(location_id)) return json({ error: "location_id required" }, 400);
    if (!Array.isArray(personnel_ids) || personnel_ids.length === 0 || personnel_ids.length > 100 ||
      !personnel_ids.every((i: unknown) => typeof i === "string" && UUID.test(i))) {
      return json({ error: "personnel_ids must be 1-100 UUIDs" }, 400);
    }
    let reportAt: string | null = null;
    if (report_at != null && report_at !== "") {
      const d = new Date(String(report_at));
      if (isNaN(d.getTime())) return json({ error: "invalid report_at" }, 400);
      reportAt = d.toISOString();
    }
    const note = typeof custom_note === "string" ? custom_note.trim().slice(0, 300) : "";

    const { data: loc, error: locErr } = await service.from("project_locations")
      .select("name, address, city, state, zip, poc_name, poc_phone, timezone, project_id, status").eq("id", location_id).maybeSingle();
    if (locErr || !loc) return json({ error: "Location not found" }, 404);
    if(loc.status==='closed')return json({error:'Location is closed'},409);
    const {data:project,error:projectError}=await service.from('projects').select('*').eq('id',loc.project_id).single();if(projectError)throw projectError;const zone=locationZone(loc,project);
    const addr = [loc.address, [loc.city, [loc.state, loc.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");

    const { data: people, error: pErr } = await service.from("personnel")
      .select("id, first_name, phone, applicant_id").in("id", personnel_ids);
    if (pErr) return json({ error: pErr.message }, 500);

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_PHONE_NUMBER");
    const siteUrl = (Deno.env.get("SITE_URL") || "https://fairfieldrg.com").replace(/\/$/, "");
    if (!sid || !twToken || !from) return json({ error: "Twilio not configured" }, 500);

    const results: any[] = [];
    for (const pid of personnel_ids) {
      const p: any = (people ?? []).find((x: any) => x.id === pid);
      if (!p) { results.push({ personnel_id: pid, status: "failed", reason: "not found" }); continue; }
      const d = String(p.phone ?? "").replace(/\D/g, "");
      const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
      if (ten.length !== 10) { results.push({ personnel_id: pid, status: "failed", reason: "no valid phone" }); continue; }

      const { data: tok, error: tErr } = await service.from("site_checkin_tokens")
        .insert({ personnel_id: pid, location_id, report_at: reportAt, created_by: user.id }).select("id").single();
      if (tErr || !tok) { results.push({ personnel_id: pid, status: "failed", reason: tErr?.message ?? "token failed" }); continue; }

      let msg = `FRG: You're assigned to ${loc.name}`;
      if (include.address && addr) msg += `\n${addr}`;
      if (include.report_time && reportAt) msg += `\nReport: ${localStamp(reportAt,zone)}`;
      if (include.poc && (loc.poc_name || loc.poc_phone)) msg += `\nPOC: ${[loc.poc_name, loc.poc_phone].filter(Boolean).join(" ")}`;
      if (note) msg += `\n${note}`;
      msg += `\nWhen you arrive, tap to check in: ${siteUrl}/punch/${tok.id}\nTap again when you leave to check out.`;

      let status = "sent", err: string | null = null, twilioSid: string | null = null;
      try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${btoa(`${sid}:${twToken}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: `+1${ten}`, From: from, Body: msg }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { status = "failed"; err = data?.message ?? `HTTP ${res.status}`; } else twilioSid = data?.sid ?? null;
      } catch (e) { status = "failed"; err = String(e); }

      if (p.applicant_id) {
        const { error: logErr } = await service.from("applicant_messages").insert({
          applicant_id: p.applicant_id, channel: "sms", body: msg, status, error: err, twilio_sid: twilioSid, created_by: user.id,
        });
        if (logErr) console.error("[site-sms] log failed", logErr.message);
      }
      results.push({ personnel_id: pid, status, reason: err ?? undefined });
    }
    return json({ results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
