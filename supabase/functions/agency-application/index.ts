import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { service, json } from '../_shared/signinJobs.ts';
import { mayAttributeAgency } from '../_shared/agencyRules.ts';
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('submit'), agency_token: z.string().uuid(), posting_id: z.string().uuid(), applicant: z.object({ first_name: z.string().trim().min(1).max(100), last_name: z.string().trim().min(1).max(100), email: z.string().email().max(255), phone: z.string().max(40), address: z.string().max(500).optional(), city: z.string().max(100).optional(), state: z.string().max(100).optional(), home_zip: z.string().max(20).optional(), photo_url: z.string().max(2000).optional() }), answers: z.record(z.unknown()), geo: z.object({ lat: z.number().min(-90).max(90).nullable(), lng: z.number().min(-180).max(180).nullable(), accuracy: z.number().min(0).nullable(), source: z.enum(['device','ip_fallback']).nullable(), capturedAt: z.string().nullable(), error: z.string().nullable() }).optional(), clientSubmittedAt: z.string().datetime().optional(), userAgent: z.string().max(1000).optional(), smsConsent: z.boolean().optional(), smsConsentPhone: z.string().max(40).optional(), smsConsentTextVersion: z.string().max(100).optional() }),
  z.object({ action: z.literal('quick'), agency_token: z.string().uuid(), token: z.string().min(1).max(200), phone: z.string().max(40).nullable(), email: z.string().email().max(255).nullable() }),
]);
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const raw = await req.text(); if (raw.length > 300000) return json({ error: 'Application too large' }, 400);
    const parsed = schema.safeParse(JSON.parse(raw)); if (!parsed.success) return json({ error: 'Invalid application' }, 400);
    const v = parsed.data, db = service();
    const { data: vendor, error: ve } = await db.from('vendors').select('id').eq('signup_token', v.agency_token).eq('status','active').maybeSingle(); if (ve) throw ve; if (!vendor) return json({ error: 'Agency link unavailable' }, 400);
    if (v.action === 'quick') {
      // Invite token is proof of this applicant relationship; never accept an arbitrary applicant ID.
      const { data: invite, error: ie } = await db.rpc('get_quick_apply_invite', { _token: v.token }); if (ie) throw ie;
      if (!invite?.valid || !invite?.applicant?.id || invite.used) return json({ error: 'Invite unavailable' }, 403);
      const { data: result, error: qe } = await db.rpc('confirm_quick_apply', { _token: v.token, _phone: v.phone, _email: v.email }); if (qe) throw qe;
      if (result?.success && mayAttributeAgency(null,'invite')) { const {error}=await db.from('applicants').update({ vendor_id: vendor.id }).eq('id', invite.applicant.id).is('vendor_id',null);if(error)throw error; }
      return json(result);
    }
    const { data: posting, error: pe } = await db.from('job_postings').select('id').eq('id',v.posting_id).eq('is_open',true).maybeSingle();if(pe)throw pe;if(!posting)return json({error:'Posting unavailable'},403);
    const a=v.applicant;
    const {data:existing,error:ee}=await db.rpc('find_applicant_id_by_contact',{_email:a.email,_phone:a.phone});if(ee)throw ee;
    let applicantId=existing;
    if(!applicantId){
      const created=await db.from('applicants').insert({id:crypto.randomUUID(),first_name:a.first_name,last_name:a.last_name,email:a.email,phone:a.phone,address:a.address??null,city:a.city??null,state:a.state??null,home_zip:a.home_zip??null,photo_url:a.photo_url??null,vendor_id:vendor.id}).select('id').single();
      if(created.error){if(created.error.code!=='23505')throw created.error;const retry=await db.rpc('find_applicant_id_by_contact',{_email:a.email,_phone:a.phone});if(retry.error||!retry.data)throw created.error;applicantId=retry.data;}else applicantId=created.data.id;
    }
    const {data:active,error:ae}=await db.rpc('has_active_application_for_posting',{_applicant_id:applicantId,_job_posting_id:posting.id});if(ae)throw ae;
    const {data:id,error}=await db.rpc(active?'resubmit_application':'create_application_return_id',{_job_posting_id:posting.id,_applicant_id:applicantId,_answers:v.answers,_client_submitted_at:v.clientSubmittedAt??null,_geo_lat:v.geo?.lat??null,_geo_lng:v.geo?.lng??null,_geo_accuracy:v.geo?.accuracy??null,_geo_source:v.geo?.source??null,_geo_captured_at:v.geo?.capturedAt??null,_geo_error:v.geo?.error??null,_user_agent:v.userAgent??null,_sms_consent:!!v.smsConsent,_sms_consent_phone:v.smsConsent?v.smsConsentPhone??null:null,_sms_consent_text_version:v.smsConsent?v.smsConsentTextVersion??'v1.0':null});if(error)throw error;
    return json({id,applicant_id:applicantId,agency_retained:!!existing});
  } catch { return json({ error: 'Application could not be submitted' }, 500); }
});