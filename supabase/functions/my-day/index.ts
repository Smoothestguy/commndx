import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const schema = z.object({ action: z.literal('read') }).strict();
async function rows(make: (offset: number) => PromiseLike<{data: any[] | null; error: any}>) {
  const out: any[] = [];
  for (let o = 0; ; o += 500) { const r = await make(o); if (r.error) throw r.error; out.push(...r.data ?? []); if ((r.data ?? []).length < 500) return out; }
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({error:'Method not allowed'},405);
  try {
    if (!schema.safeParse(await req.json()).success) return json({error:'Invalid request'},400);
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const {data: auth,error} = await db.auth.getUser((req.headers.get('Authorization') ?? '').replace(/^Bearer /,''));
    if (error || !auth.user) return json({error:'Unauthorized'},401);
    const uid = auth.user.id;
    const {data: person,error: pe} = await db.from('personnel').select('id').eq('user_id',uid).maybeSingle();
    if (pe) throw pe;
    const pid = person?.id;
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const p = (key: string) => parts.find(p => p.type === key)?.value;
    const today = `${p('year')}-${p('month')}-${p('day')}`;
    const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
    const week = date.toISOString().slice(0,10); date.setUTCDate(date.getUTCDate()+7); const end = date.toISOString().slice(0,10);
    const scope = (q: any) => pid ? q.eq('personnel_id',pid) : q.eq('user_id',uid);
    const [entries, assignments, open, requests] = await Promise.all([
      rows(o => scope(db.from('time_entries').select('id,entry_date,hours')).gte('entry_date',week).lt('entry_date',end).order('id').range(o,o+499)),
      pid ? rows(o => db.from('location_assignments').select('location_id,assigned_at,unassigned_at,mission_day,mission_note').eq('personnel_id',pid).eq('status','active').order('id').range(o,o+499)) : [],
      pid ? rows(o => db.from('personnel_location_trail').select('location_id,in_at').eq('personnel_id',pid).is('out_at',null).order('visit_personnel_id').range(o,o+499)) : [],
      pid ? rows(o => db.from('timesheet_signature_requests').select('id,location_id,sheet_date,token').eq('personnel_id',pid).eq('status','pending').gt('expires_at',now.toISOString()).order('id').range(o,o+499)) : [],
    ]);
    const ids = [...new Set([...assignments,...open,...requests].map(r=>r.location_id))];
    const locations = ids.length ? await rows(o=>db.from('project_locations').select('id,project_id,name,address,city,state,zip,poc_name,poc_phone,timezone,status,mobe_date,demobe_date,day_shift_start,day_shift_end,night_shift_start,night_shift_end').in('id',ids).order('id').range(o,o+499)) : [];
    const projectIds = [...new Set(locations.map(l=>l.project_id))];
    const projects = projectIds.length ? await rows(o=>db.from('projects').select('id,name,day_shift_start,day_shift_end,night_shift_start,night_shift_end,status,archived_at').in('id',projectIds).order('id').range(o,o+499)) : [];
    const demobilized = pid ? await rows(o=>db.from('personnel_current_status').select('project_id').eq('personnel_id',pid).eq('status','demobilized').order('project_id').range(o,o+499)) : [];
    const sites = locations.filter(l=> {
      const project = projects.find(p=>p.id===l.project_id);
      const a = assignments.find(a=>a.location_id===l.id);
      const dateParts = new Intl.DateTimeFormat('en-CA',{timeZone:l.timezone||'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
      const part=(key:string)=>dateParts.find(p=>p.type===key)?.value;
      const localDate=`${part('year')}-${part('month')}-${part('day')}`;
      return l.status==='active' && project?.status==='active' && !project.archived_at && !demobilized.some(d=>d.project_id===l.project_id) && (!l.mobe_date||l.mobe_date<=localDate) && (!l.demobe_date||l.demobe_date>=localDate) && a && (!a.assigned_at || Date.parse(a.assigned_at)<=now.getTime()) && (!a.unassigned_at || Date.parse(a.unassigned_at)>now.getTime());
    }).map(l=>({ ...l, project: projects.find(p=>p.id===l.project_id), openAt: open.find(o=>o.location_id===l.id)?.in_at ?? null }));
    // Only the authenticated person's own bearer links leave this function, never other roster links.
    const links = pid && sites.length ? await rows(o=>db.from('site_checkin_tokens').select('id,location_id,expires_at,created_at').eq('personnel_id',pid).in('location_id',sites.map(l=>l.id)).gt('expires_at',now.toISOString()).order('created_at',{ascending:false}).order('id').range(o,o+499)) : [];
    return json({ linked: !!pid, week, hours: entries.reduce((n,e)=>n+Number(e.hours || 0),0), sites: sites.map(l=>({...l,punchLink:links.find(t=>t.location_id===l.id)?.id ?? null})), requests: requests.map(r=>({id:r.id,date:r.sheet_date,location:locations.find(l=>l.id===r.location_id)?.name ?? 'Location',link:r.token})) });
  } catch { return json({error:'My Day is temporarily unavailable'},500); }
});