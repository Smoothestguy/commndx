// Admin-only: recover inbound MMS from the last 30 days that the webhook dropped.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  buildMetadata, findExistingConversation, findSenders, storeMedia, twilioAuthHeader, type MediaItem,
} from "../_shared/smsMedia.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// deno-lint-ignore-file no-explicit-any
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u.user) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Admins only" }, 403);

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const to = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!sid || !to || !Deno.env.get("TWILIO_AUTH_TOKEN")) return json({ error: "Twilio is not configured" }, 500);

    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const base = "https://api.twilio.com";
    let next: string | null = `/2010-04-01/Accounts/${sid}/Messages.json?To=${encodeURIComponent(to)}&DateSent%3E=${since}&PageSize=200`;
    const candidates: any[] = [];
    let pages = 0;
    while (next && pages < 25) {
      const r = await fetch(base + next, { headers: { Authorization: twilioAuthHeader() } });
      if (!r.ok) return json({ error: "Twilio list failed", status: r.status, details: await r.text() }, 502);
      const page = await r.json();
      for (const m of page.messages ?? []) {
        if (String(m.direction).startsWith("inbound") && Number(m.num_media) > 0) candidates.push(m);
      }
      next = page.next_page_uri ?? null;
      pages++;
    }

    const summary = { found: candidates.length, already_present: 0, recovered: 0, no_conversation: 0, media_failures: 0, errors: 0 };
    for (const m of candidates) {
      try {
        const { data: existing } = await supabase.from("conversation_messages").select("id")
          .eq("metadata->>twilio_sid", m.sid).limit(1);
        if (existing && existing.length) { summary.already_present++; continue; }

        const senders = await findSenders(supabase, m.from);
        const conv = await findExistingConversation(supabase, senders);
        if (!conv) { summary.no_conversation++; continue; }

        const mr = await fetch(`${base}/2010-04-01/Accounts/${sid}/Messages/${m.sid}/Media.json`, { headers: { Authorization: twilioAuthHeader() } });
        const items: MediaItem[] = mr.ok
          ? ((await mr.json()).media_list ?? []).map((x: any) => ({ url: base + String(x.uri).replace(/\.json$/, ""), contentType: x.content_type || "" }))
          : [];
        const stored = await storeMedia(supabase, conv.conversationId, m.sid, items);
        if (!mr.ok) stored.media_errors.push({ index: -1, content_type: "", error: `media list ${mr.status}` });
        if (stored.media_errors.length) summary.media_failures++;
        const body = (m.body ?? "").trim();
        const { error } = await supabase.from("conversation_messages").insert({
          conversation_id: conv.conversationId,
          sender_type: conv.sender.type,
          sender_id: conv.sender.id,
          content: body,
          message_type: "sms",
          created_at: new Date(m.date_sent ?? m.date_created).toISOString(),
          metadata: { ...buildMetadata(m.sid, stored), backfilled: true },
        });
        if (error) { summary.errors++; console.error("insert failed", m.sid, error.message); continue; }
        summary.recovered++;
      } catch (e) {
        summary.errors++;
        console.error("backfill item failed", m.sid, e);
      }
    }
    return json(summary);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
