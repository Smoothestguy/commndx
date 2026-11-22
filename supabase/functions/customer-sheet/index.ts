import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

// Short-lived download link for an approved (locked) sign-in sheet PDF.
// Callers: staff (admin/manager) or Customer Ops users scoped to their customer's locations.
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const schema = z.object({ sheet_day_id: z.string().uuid() });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const parsed = schema.safeParse(await req.json()); if (!parsed.success) return json({ error: 'Invalid request' }, 400);
    const auth = req.headers.get('Authorization') ?? ''; if (!auth.startsWith('Bearer ')) return json({ error: 'Sign in required' }, 401);
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: u } = await db.auth.getUser(auth.slice(7)); if (!u?.user) return json({ error: 'Sign in required' }, 401);
    const { data: sheet, error } = await db.from('signin_sheet_days').select('location_id,sheet_date,status,pdf_url').eq('id', parsed.data.sheet_day_id).maybeSingle();
    if (error) throw error; if (!sheet) return json({ error: 'Not found' }, 404);
    const { data: roles } = await db.from('user_roles').select('role').eq('user_id', u.user.id);
    if (!roles?.some((r: any) => r.role === 'admin' || r.role === 'manager')) {
      if (!roles?.some((r: any) => r.role === 'customer_ops')) return json({ error: 'Not authorized' }, 403);
      const asUser = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } });
      const { data: ok } = await asUser.rpc('customer_ops_location_ok', { _location: sheet.location_id });
      if (ok !== true) return json({ error: 'Not authorized' }, 403);
    }
    if (sheet.status !== 'locked' || !sheet.pdf_url) return json({ error: 'This sheet has not been approved yet' }, 409);
    const { data: signed, error: se } = await db.storage.from('project-documents').createSignedUrl(sheet.pdf_url, 600, { download: `signin-${sheet.sheet_date}.pdf` });
    if (se || !signed) throw se ?? new Error('sign failed');
    return json({ url: signed.signedUrl });
  } catch (e) { console.error('customer-sheet', e instanceof Error ? e.message : e); return json({ error: 'Sheet unavailable' }, 500); }
});
