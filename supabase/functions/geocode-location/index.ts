import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import tzLookup from 'https://esm.sh/tz-lookup@6.1.25';

const input = z.object({ location_id: z.string().uuid().optional(), address: z.string().trim().min(3).max(1000).optional(), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() }).refine(v => !!v.address || (v.lat !== undefined && v.lng !== undefined), 'Address or coordinates required');
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return json({ error: 'Sign in required' }, 401);
    const { data: roles, error: roleError } = await db.from('user_roles').select('role').eq('user_id', user.id);
    if (roleError || !roles?.some(r => r.role === 'admin' || r.role === 'manager')) return json({ error: 'Manager access required' }, 403);
    const parsed = input.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const v = parsed.data;
    let lat = v.lat, lng = v.lng;
    if (v.address) {
      const token = Deno.env.get('MapBox');
      if (!token) return json({ error: 'Mapbox is not configured' }, 503);
      const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(v.address)}.json?limit=1&access_token=${encodeURIComponent(token)}`);
      if (!response.ok) { const details = await response.text(); console.error('Mapbox geocoding failed', response.status, details); return json({ error: 'Mapbox geocoding failed', status: response.status, details }, response.status); }
      const result = await response.json();
      const center = result.features?.[0]?.center;
      if (!center || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) return json({ error: 'No matching address found' }, 404);
      [lng, lat] = center;
    }
    if (lat === undefined || lng === undefined) return json({ error: 'Coordinates required' }, 400);
    const timezone = tzLookup(lat, lng);
    if (v.location_id) {
      const { data, error } = await db.from('project_locations').update({ lat, lng, timezone }).eq('id', v.location_id).select('id').single();
      if (error || !data) return json({ error: error?.message ?? 'Location unavailable' }, 400);
    }
    return json({ lat, lng, timezone });
  } catch { return json({ error: 'Unable to geocode location' }, 400); }
});