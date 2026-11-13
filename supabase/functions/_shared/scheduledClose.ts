import { service, provider } from './signinJobs.ts';
export function autoCloseMessage(at:string,zone:string,link:string){
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(at)).replace(':','');
 return `You were clocked out at ${time} per schedule. If you worked later, tap here ${link}`;
}
export async function scheduledClose(db:ReturnType<typeof service>,dry:boolean,at?:string,location?:string){
 const result=await db.rpc('scheduled_close_punches',{p_at:at||new Date().toISOString(),p_dry:dry,p_location:location||null});if(result.error)throw result.error;
 const entries=result.data?.entries||[];let sent=0;
 if(!dry){
 // Read committed unsent closures too: a stopped run does not lose the notification.
 type Closure={id:string;personnel_id:string;checked_out_at:string;scheduled_start_at:string|null;scheduled_end_at:string|null;auto_closed_at:string;location_visits:{location_id:string;project_locations:{timezone:string|null;projects:{timezone:string|null}}}};
 const pending=await db.from('visit_personnel').select('id,personnel_id,checked_out_at,scheduled_start_at,scheduled_end_at,auto_closed_at,location_visits!inner(location_id,project_locations!inner(timezone,projects!inner(*)))').gte('auto_closed_at',new Date(Date.now()-48*3600000).toISOString()).order('auto_closed_at').limit(500).returns<Closure[]>();if(pending.error)throw pending.error;
 for(const s of pending.data||[]){const l=s.location_visits,zone=l.project_locations.timezone||l.project_locations.projects.timezone||'America/Chicago',day=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s.scheduled_start_at||s.auto_closed_at));
 const person=await db.from('personnel').select('phone,applicant_id').eq('id',s.personnel_id).single();if(person.error)throw person.error;
 if(person.data.applicant_id){const opt=await db.from('applicants').select('sms_opted_out').eq('id',person.data.applicant_id).single();if(opt.error)throw opt.error;if(opt.data.sms_opted_out)continue;}
 const legacy=await db.from('alert_log').select('id').eq('kind','scheduled-auto-close').eq('personnel_id',s.personnel_id).eq('location_id',l.location_id).eq('alert_date',day).maybeSingle();if(legacy.error)throw legacy.error;if(legacy.data)continue;
 const reserved=await db.from('alert_log').insert({kind:`scheduled-auto-close:${s.id}`,personnel_id:s.personnel_id,location_id:l.location_id,alert_date:day,detail:'pending · forgot to clock out'}).select('id').single();if(reserved.error){if(reserved.error.code==='23505')continue;throw reserved.error;}
 try{const sid=Deno.env.get('TWILIO_ACCOUNT_SID'),secret=Deno.env.get('TWILIO_AUTH_TOKEN'),from=Deno.env.get('TWILIO_PHONE_NUMBER');if(!sid||!secret||!from)throw new Error('SMS configuration missing');
 const digits=String(person.data.phone||'').replace(/\D/g,''),phone=digits.length===10?'+1'+digits:digits.length===11&&digits.startsWith('1')?'+'+digits:null;if(!phone)throw new Error('No valid phone');
 let token=await db.from('site_checkin_tokens').select('id').eq('personnel_id',s.personnel_id).eq('location_id',l.location_id).gt('expires_at',new Date(Date.now()+3600000).toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();if(token.error)throw token.error;if(!token.data)token=await db.from('site_checkin_tokens').insert({personnel_id:s.personnel_id,location_id:l.location_id}).select('id').single();if(token.error||!token.data)throw new Error('Personal link unavailable');
 const link=`${(Deno.env.get('SITE_URL')||'https://fairfieldrg.com').replace(/\/$/,'')}/punch/${token.data.id}?extension=1`;
 await provider(await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${btoa(`${sid}:${secret}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({To:phone,From:from,Body:autoCloseMessage(s.scheduled_end_at||s.checked_out_at,zone,link)})}));
 await db.from('alert_log').update({detail:'SMS sent · forgot to clock out'}).eq('id',reserved.data.id);sent++;
 }catch{await db.from('alert_log').update({detail:'failed or delivery uncertain · auto-close notice'}).eq('id',reserved.data.id);}
 }}
 return {dry_run:dry,eligible:entries.filter((s:{blocked?:boolean})=>!s.blocked).length,blocked:entries.filter((s:{blocked?:boolean})=>s.blocked).length,sent,...(dry?{diagnostics:entries.map((s:{end_at?:string;timezone?:string;blocked?:boolean})=>s.blocked?{blocked:true}:{end_at:s.end_at,timezone:s.timezone,message:autoCloseMessage(s.end_at||'',s.timezone||'America/Chicago','[personal extension link]')})}:{})};
}