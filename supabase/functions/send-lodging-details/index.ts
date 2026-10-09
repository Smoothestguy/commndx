// Sends lodging details (address, dates, room, door codes, host rules) to assigned
// personnel via SMS (Twilio) and email (Resend). Staff-only (admin/manager/user).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPE_LABELS: Record<string, string> = {
  hotel: "Hotel", airbnb: "Airbnb", rental_house: "Rental House", bunk_trailer: "Bunk Trailer", other: "Lodging",
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

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
    const ids = body?.assignment_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || !ids.every((i) => typeof i === "string" && UUID.test(i))) {
      return json({ error: "assignment_ids must be 1-100 UUIDs" }, 400);
    }

    const { data: rows, error } = await service
      .from("personnel_hotel_assignments")
      .select("*, personnel:personnel_id(first_name, phone, email, applicant_id)")
      .in("id", ids);
    if (error) return json({ error: error.message }, 500);

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_PHONE_NUMBER");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const resend = resendKey ? new Resend(resendKey) : null;

    const results: any[] = [];
    for (const a of rows ?? []) {
      const p: any = a.personnel ?? {};
      const type = TYPE_LABELS[a.lodging_type ?? "hotel"] ?? "Lodging";
      const cityLine = [a.hotel_city, [a.hotel_state, a.hotel_zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      const addr = [a.hotel_address, cityLine].filter(Boolean).join(", ");
      const lines = [
        `FRG Lodging — ${type} ${a.hotel_name}`,
        addr || null,
        `Check-in ${a.check_in} → ${a.check_out ?? "TBD"}`,
        a.room_number ? `Room/Unit: ${a.room_number}` : null,
        a.access_codes ? `Codes: ${a.access_codes}` : null,
        a.host_instructions || null,
        "Questions? Call the office.",
      ].filter(Boolean) as string[];
      const message = lines.join("\n");

      let smsOk = false, emailOk = false; const errors: string[] = [];

      const d = String(p.phone ?? "").replace(/\D/g, "");
      const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
      if (ten.length === 10 && sid && twToken && from) {
        let status = "sent", err: string | null = null, twilioSid: string | null = null;
        try {
          const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: "POST",
            headers: { Authorization: `Basic ${btoa(`${sid}:${twToken}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ To: `+1${ten}`, From: from, Body: message }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) { status = "failed"; err = data?.message ?? `HTTP ${res.status}`; } else twilioSid = data?.sid ?? null;
        } catch (e) { status = "failed"; err = String(e); }
        smsOk = status === "sent";
        if (err) errors.push(`sms: ${err}`);
        if (p.applicant_id) {
          const { error: logErr } = await service.from("applicant_messages").insert({
            applicant_id: p.applicant_id, channel: "sms", body: message, status, error: err, twilio_sid: twilioSid, created_by: user.id,
          });
          if (logErr) console.error("[lodging] log failed", logErr.message);
        }
      } else if (ten.length !== 10) errors.push("no valid phone");

      const email = String(p.email ?? "").trim();
      if (resend && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        try {
          const r = await resend.emails.send({
            from: "Fairfield <admin@fairfieldrg.com>",
            to: [email],
            reply_to: "admin@fairfieldrg.com",
            subject: `Your lodging: ${a.hotel_name}`,
            text: message,
            html: `<div style="font-family:sans-serif;white-space:pre-wrap">${esc(message)}</div>`,
          });
          if (r.error) errors.push(`email: ${r.error.message}`); else emailOk = true;
        } catch (e) { errors.push(`email: ${String(e)}`); }
      }

      if (smsOk || emailOk) {
        await service.from("personnel_hotel_assignments").update({
          notified_at: new Date().toISOString(),
          notified_via: smsOk && emailOk ? "sms+email" : smsOk ? "sms" : "email",
        }).eq("id", a.id);
      }
      results.push({ assignment_id: a.id, sms: smsOk, email: emailOk, error: errors.length ? errors.join("; ") : undefined });
    }
    return json({ results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
