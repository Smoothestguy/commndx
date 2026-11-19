import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { authenticateCronRequest } from '../_shared/cron-auth.ts';
import { CHECK_WINDOW_MS, retrieveDelivery } from '../_shared/onboardingDelivery.ts';
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const denied = authenticateCronRequest(request);
  if (denied) return new Response(await denied.text(), { status: denied.status, headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const key = Deno.env.get('RESEND_API_KEY');
    if (!url || !service || !key) throw new Error('Missing delivery monitor configuration');
    const db = createClient(url, service); let checked = 0; let failures = 0;
    // Snapshot IDs before updating rows; stable pagination cannot skip pending rows.
    const pending: { id: string; resend_id: string }[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from('onboarding_email_deliveries').select('id,resend_id').gte('sent_at', new Date(Date.now() - CHECK_WINDOW_MS).toISOString()).is('final_status', null).order('id').range(offset, offset + 499);
      if (error) throw error; pending.push(...(data ?? [])); if ((data?.length ?? 0) < 500) break;
    }
    for (const row of pending) {
      try {
        const status = await retrieveDelivery(row.resend_id, key);
        if (!status) continue;
        const { error } = await db.from('onboarding_email_deliveries').update({ last_event: status.event, final_status: status.final, checked_at: new Date().toISOString() }).eq('id', row.id);
        if (error) throw error; checked++;
      } catch (error) { failures++; console.error(String(error)); }
      // Resend's default request limit is 2/second. This is pacing, not a retry.
      await new Promise(resolve => setTimeout(resolve, 550));
    }
    // Include terminal failures so notification failures can retry independently of retrieval.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from('onboarding_email_deliveries').select('id,final_status,token_id').order('id').range(offset, offset + 499);
      if (error) throw error;
      for (const row of data ?? []) {
        if (row.final_status) { const { error: alertError } = await db.rpc('record_onboarding_delivery_alert', { p_delivery_id: row.id, p_event: row.final_status }); if (alertError) throw alertError; }
        if (row.token_id) { const { error: alertError } = await db.rpc('record_onboarding_delivery_alert', { p_delivery_id: row.id, p_event: 'not_opened' }); if (alertError) throw alertError; }
      }
      if ((data?.length ?? 0) < 500) break;
    }
    return Response.json({ checked, failures }, { headers: corsHeaders });
  } catch (error) { console.error(String(error)); return Response.json({ error: String(error) }, { status: 500, headers: corsHeaders }); }
});
