import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import tzLookup from 'https://esm.sh/tz-lookup@6.1.25';
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const input = z.object({ token: z.string().uuid(), at: z.string().datetime().optional() }).safeParse(await req.json());
    if (!input.success) return json({ error: 'Invalid token' }, 400);
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: token } = await db.from('site_checkin_tokens').select('location_id,personnel_id,expires_at').eq('id', input.data.token).single();
    if (!token || Date.parse(token.expires_at) <= Date.now()) return json({ error: 'Inactive link' }, 403);
    const { data: location } = await db.from('project_locations').select('timezone').eq('id', token.location_id).single();
    const timezone = location?.timezone || 'America/Chicago';
    const requested = Math.min(Date.now(), Math.max(Date.now() - 48 * 3600000, Date.parse(input.data.at || new Date().toISOString())));
    const date = (at: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
    const day = date(new Date(requested).toISOString());
    const { data: rows, error } = await db.from('personnel_location_trail').select('in_at,out_at').eq('location_id', token.location_id).eq('personnel_id', token.personnel_id).gte('in_at', new Date(requested - 2 * 86400000).toISOString()).order('in_at', { ascending: false });
    if (error) return json({ error: 'History unavailable' }, 400);
    const row = rows?.find(r => r.in_at && date(r.in_at) === day);
    return json({ in_at: row?.in_at ?? null, out_at: row?.out_at ?? null, timezone });
  } catch { return json({ error: 'History unavailable' }, 400); }
});