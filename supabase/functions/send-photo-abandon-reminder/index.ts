// Sends a reminder SMS to admin about applicants who uploaded photos but didn't complete.
// Invoked by pg_cron on a schedule. No user auth required (called with service role key).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_PHONE = "+12817483832";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Stop after 1pm Central (18:00 UTC) today
    const nowUtc = new Date();
    const chicagoHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "2-digit",
        hour12: false,
      }).format(nowUtc)
    );
    if (chicagoHour > 13 || chicagoHour < 4) {
      return new Response(JSON.stringify({ skipped: true, reason: "outside window" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Query DB via PostgREST with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const q =
      `${supabaseUrl}/rest/v1/applicants?select=first_name,last_name,phone,email,photo_url,created_at` +
      `&photo_url=not.is.null`;
    const res = await fetch(q, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const applicants = (await res.json()) as Array<{
      first_name: string; last_name: string; phone: string; email: string;
      photo_url: string | null; created_at: string;
    }>;

    // Filter to those with no applications
    const appRes = await fetch(
      `${supabaseUrl}/rest/v1/applications?select=applicant_id`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const apps = (await appRes.json()) as Array<{ applicant_id: string }>;

    // Better: use the exact query — pull applicants with photo + no applications
    const q2 = `${supabaseUrl}/rest/v1/rpc/list_photo_abandoners`;
    // fallback: do it in JS
    const abandonersRes = await fetch(
      `${supabaseUrl}/rest/v1/applicants?select=id,first_name,last_name,phone,email,photo_url,created_at&photo_url=not.is.null`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const withPhoto = await abandonersRes.json() as Array<any>;
    const withApps = new Set(apps.map(a => a.applicant_id));
    const abandoners = withPhoto.filter(a => !withApps.has(a.id));

    let body: string;
    if (abandoners.length === 0) {
      body = `[${new Date().toLocaleTimeString("en-US", { timeZone: "America/Chicago" })} CT] No photo-abandoned applicants pending.`;
    } else {
      const list = abandoners
        .slice(0, 5)
        .map((a: any) => `${a.first_name} ${a.last_name} ${a.phone}`)
        .join("; ");
      body = `Photo uploaded but application not completed (${abandoners.length}): ${list}`;
    }

    // Send via Twilio
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const from = Deno.env.get("TWILIO_PHONE_NUMBER")!;
    const twRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: ADMIN_PHONE, From: from, Body: body }),
      }
    );
    const twData = await twRes.json();

    return new Response(JSON.stringify({ ok: twRes.ok, count: abandoners.length, twilio: twData }), {
      status: twRes.ok ? 200 : 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
