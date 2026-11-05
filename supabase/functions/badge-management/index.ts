import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { service, authorize, json } from '../_shared/signinJobs.ts';
const schema = z.object({ action: z.enum(['issue', 'revoke', 'resolve']), personnel_id: z.string().uuid().optional(), badge: z.string().uuid().optional(), location_id: z.string().uuid().optional() });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const parsed = schema.safeParse(await req.json()); if (!parsed.success) return json({ error: 'Invalid badge request' }, 400);
    const db = service(), auth = await authorize(req, db); if (!auth?.uid) return json({ error: 'Manager access required' }, 403);
    const v = parsed.data;
    if (v.action === 'resolve') {
      if (!v.badge || !v.location_id) return json({ error: 'Badge and location required' }, 400);
      const { data: badge, error } = await db.from('personnel_badges').select('personnel_id').eq('id', v.badge).eq('active', true).maybeSingle(); if (error) throw error;
      if (!badge) return json({ error: 'Badge inactive or unknown' }, 404);
      const { data: assignment, error: ae } = await db.from('location_assignments').select('id').eq('location_id', v.location_id).eq('personnel_id', badge.personnel_id).eq('status', 'active').limit(1).maybeSingle(); if (ae) throw ae;
      if (!assignment) return json({ error: 'Person not assigned to this location' }, 403);
      const { data: person, error: pe } = await db.from('personnel_directory').select('id,first_name,last_name').eq('id', badge.personnel_id).single(); if (pe) throw pe;
      return json({ person });
    }
    if (!v.personnel_id) return json({ error: 'Person required' }, 400);
    const { data: person, error: pe } = await db.from('personnel').select('id').eq('id', v.personnel_id).maybeSingle(); if (pe) throw pe; if (!person) return json({ error: 'Person unavailable' }, 404);
    const { error } = await db.from('personnel_badges').update({ active: false, revoked_at: new Date().toISOString() }).eq('personnel_id', v.personnel_id).eq('active', true); if (error) throw error;
    if (v.action === 'revoke') return json({ ok: true });
    const { data: badge, error: ie } = await db.from('personnel_badges').insert({ personnel_id: v.personnel_id, issued_by: auth.uid }).select('id').single(); if (ie) throw ie;
    return json({ id: badge.id });
  } catch { return json({ error: 'Badge action failed' }, 500); }
});