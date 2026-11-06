import { z } from 'npm:zod@3';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export const approvalMessage = (location: string, site: string, token: string | null) => token
  ? `You're approved for ${location}. Check in here: ${site.replace(/\/$/, '')}/punch/${token}`
  : `You're approved for ${location}. Contact your supervisor for your check-in location.`;

// Called only after the existing site-text endpoint validates a staff JWT and role.
export async function sendJoinApproval(db: SupabaseClient, uid: string, body: unknown) {
  const parsed = z.object({ action: z.literal('join_approval'), request_id: z.string().uuid(), dry_run: z.boolean().optional() }).strict().safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid approval request' }, 400);
  const { request_id, dry_run } = parsed.data;
  const { data: request, error } = await db.from('project_join_requests').select('id,status,project_id,location_id,matched_personnel_id,phone,first_name,last_name').eq('id', request_id).maybeSingle();
  if (error) return json({ error: 'Unable to read approval' }, 500);
  if (!request || request.status !== 'approved' || !request.matched_personnel_id) return json({ error: 'Request is not approved' }, 409);
  // Every recipient/token is resolved from committed approval, never accepted from the browser.
  const digits = String(request.phone).replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (!/^\d{10}$/.test(ten)) return json({ sms_status: 'failed', reason: 'Approved request has no valid phone' });
  let name: string, token: string | null = null;
  if (request.location_id) {
    const [loc, assigned, tokens] = await Promise.all([
      db.from('project_locations').select('name,project_id').eq('id', request.location_id).maybeSingle(),
      db.from('location_assignments').select('id').eq('location_id', request.location_id).eq('personnel_id', request.matched_personnel_id).eq('status', 'active').limit(1),
      db.from('site_checkin_tokens').select('id').eq('location_id', request.location_id).eq('personnel_id', request.matched_personnel_id).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1),
    ]);
    if (loc.error || assigned.error || tokens.error || loc.data?.project_id !== request.project_id || !assigned.data?.length || !tokens.data?.[0]) return json({ sms_status: 'failed', reason: 'Approved check-in link unavailable' });
    name = loc.data.name; token = tokens.data[0].id;
  } else {
    const [project, assigned] = await Promise.all([
      db.from('projects').select('name').eq('id', request.project_id).maybeSingle(),
      db.from('personnel_project_assignments').select('id').eq('project_id', request.project_id).eq('personnel_id', request.matched_personnel_id).eq('status', 'active').limit(1),
    ]);
    if (project.error || assigned.error || !project.data || !assigned.data?.length) return json({ sms_status: 'failed', reason: 'Approved project assignment unavailable' });
    name = project.data.name;
  }
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID'), secret = Deno.env.get('TWILIO_AUTH_TOKEN'), from = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!sid || !secret || !from) return json({ sms_status: 'failed', reason: 'Text service not configured' });
  const site = Deno.env.get('SITE_URL') || 'https://fairfieldrg.com';
  if (dry_run) return json({ sms_status: 'dry_run', has_punch_link: !!token });
  // Existing message PK provides one durable reservation per request; no migration needed.
  // An uncertain delivery is never retried automatically, avoiding duplicate billed texts.
  const reservation = await db.from('messages').insert({ id: request_id, recipient_type: 'personnel', recipient_id: request.matched_personnel_id, recipient_name: `${request.first_name} ${request.last_name}`, recipient_phone: `+1${ten}`, message_type: 'sms', direction: 'outbound', content: 'Project join approval notification (private check-in link omitted)', payload: { kind: 'join-approval', request_id }, status: 'sending', sent_by: uid });
  if (reservation.error) {
    if (reservation.error.code !== '23505') return json({ sms_status: 'failed', reason: 'Unable to reserve notification' });
    const previous = await db.from('messages').select('status').eq('id', request_id).maybeSingle();
    if (previous.error || !previous.data) return json({ sms_status: 'unknown', reason: 'Check message history before retrying' });
    if (previous.data.status === 'sent' || previous.data.status === 'delivered') return json({ sms_status: 'sent', already_sent: true });
    if (previous.data.status !== 'failed') return json({ sms_status: 'unknown', reason: 'Notification is sending or delivery is uncertain; check message history' });
    const claim = await db.from('messages').update({ status: 'sending', error_message: null }).eq('id', request_id).eq('status', 'failed').select('id');
    if (claim.error || !claim.data?.length) return json({ sms_status: 'unknown', reason: 'Notification already being handled' });
  }
  let status = 'unknown', reason: string | null = 'Delivery uncertain; check message history before resending', externalId: string | null = null;
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${sid}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: `+1${ten}`, From: from, Body: approvalMessage(name, site, token) }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.sid) { status = 'sent'; reason = null; externalId = result.sid; }
    else if (response.status >= 400 && response.status < 500) { status = 'failed'; reason = `Text provider rejected notification (HTTP ${response.status}${result.code ? `, code ${result.code}` : ''})`; }
  } catch { /* An ambiguous send must not be replayed. */ }
  const logged = await db.from('messages').update({ status, external_id: externalId, error_message: reason, ...(status === 'sent' ? { sent_at: new Date().toISOString() } : {}) }).eq('id', request_id);
  if (logged.error) return json({ sms_status: 'unknown', reason: 'Approval saved; notification audit update failed. Check message history.' });
  return json({ sms_status: status, reason });
}