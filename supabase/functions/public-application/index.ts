import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { service, json } from '../_shared/signinJobs.ts';
import { mayAttributeAgency } from '../_shared/agencyRules.ts';
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('submit'), agency_token: z.string().uuid().optional(), posting_token: z.string().min(16).max(200).optional(), posting_id: z.string().uuid(), applicant: z.object({ first_name: z.string().trim().min(1).max(100), last_name: z.string().trim().min(1).max(100), email: z.string().trim().toLowerCase().email().max(255), phone: z.string().max(40), address: z.string().max(500).optional(), city: z.string().max(100).optional(), state: z.string().max(100).optional(), home_zip: z.string().max(20).optional(), photo_url: z.string().max(2000).optional() }), answers: z.record(z.unknown()), geo: z.object({ lat: z.number().min(-90).max(90).nullable(), lng: z.number().min(-180).max(180).nullable(), accuracy: z.number().min(0).nullable(), source: z.enum(['device','ip_fallback']).nullable(), capturedAt: z.string().nullable(), error: z.string().nullable() }).optional(), clientSubmittedAt: z.string().datetime().optional(), userAgent: z.string().max(1000).optional(), smsConsent: z.boolean().optional(), smsConsentPhone: z.string().max(40).optional(), smsConsentTextVersion: z.string().max(100).optional(), verification: z.object({ proof_id: z.string().uuid().optional(), skip: z.boolean().optional() }).optional() }),
  z.object({ action: z.literal('quick'), agency_token: z.string().uuid(), token: z.string().min(1).max(200), phone: z.string().max(40).nullable(), email: z.string().trim().toLowerCase().email().max(255).nullable() }),
]);
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const raw = await req.text(); if (raw.length > 300000) return json({ error: 'Application too large' }, 400);
    const parsed = schema.safeParse(JSON.parse(raw)); if (!parsed.success) return json({ error: 'Invalid application' }, 400);
    const v = parsed.data, db = service();
    let vendor: {id:string}|null = null;
    if (v.agency_token) { const result = await db.from('vendors').select('id').eq('signup_token',v.agency_token).eq('status','active').maybeSingle(); if(result.error)throw result.error; vendor=result.data; if(!vendor)return json({error:'Agency link unavailable'},403); }
    if (v.action === 'quick') {
      if(!vendor)return json({error:'Agency link unavailable'},403);
      // Invite token is proof of this applicant relationship; never accept an arbitrary applicant ID.
      const { data: invite, error: ie } = await db.rpc('get_quick_apply_invite', { _token: v.token }); if (ie) throw ie;
      if (!invite?.valid || !invite?.applicant?.id || invite.used) return json({ error: 'Invite unavailable' }, 403);
      const { data: result, error: qe } = await db.rpc('confirm_quick_apply', { _token: v.token, _phone: v.phone, _email: v.email }); if (qe) throw qe;
      if (result?.success) { const current=await db.from('applicants').select('vendor_id').eq('id',invite.applicant.id).single();if(current.error)throw current.error;if(mayAttributeAgency(current.data.vendor_id,'invite')){const {error}=await db.from('applicants').update({ vendor_id: vendor.id }).eq('id', invite.applicant.id).is('vendor_id',null);if(error)throw error;} }
      return json(result);
    }
    if(!vendor&&!v.posting_token)return json({error:'Posting link required'},403);
    let postingQuery=db.from('job_postings').select('id').eq('id',v.posting_id).eq('is_open',true); if(!vendor)postingQuery=postingQuery.eq('public_token',v.posting_token);
    const { data: posting, error: pe } = await postingQuery.maybeSingle();if(pe)throw pe;if(!posting)return json({error:'Posting unavailable'},403);
    const {data:receipt,error}=await db.rpc('submit_public_application',{p_posting:posting.id,p_applicant:{...v.applicant,email:v.applicant.email.trim().toLowerCase()},p_submission:v,p_vendor:vendor?.id??null});
    if(error)throw error;
    return json(receipt);
  } catch (error) { console.error('Application submit failed', {code:(error as {code?:string})?.code}); return json({ error: 'Application could not be submitted' }, 500); }
});