import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { autoCloseMessage, scheduledClose } from '../_shared/scheduledClose.ts';

function fakeDb(optedOut=false) {
 const reservations=new Set<string>();
 const stay={id:'stay-one',personnel_id:'worker',checked_out_at:'2026-11-13T23:15:00Z',scheduled_start_at:'2026-11-13T12:30:00Z',scheduled_end_at:'2026-11-13T22:00:00Z',auto_closed_at:'2026-11-13T22:05:00Z',location_visits:{location_id:'location',project_locations:{timezone:null,projects:{timezone:'America/New_York'}}}};
 const calls:string[]=[];
 const db={rpc:()=>Promise.resolve({data:{entries:[{end_at:stay.scheduled_end_at,timezone:'America/New_York'}]},error:null}),from:(table:string)=>{
  let inserted:any=null;let kind='';
  const q:any={select:()=>q,returns:()=>q,eq:(k:string,v:string)=>{if(k==='kind')kind=v;return q;},gte:()=>q,gt:()=>q,order:()=>q,limit:()=>q,update:()=>q,insert:(v:any)=>{inserted=v;calls.push(table);return q;},maybeSingle:()=>Promise.resolve({data:table==='site_checkin_tokens'?{id:'private-test-token'}:null,error:null}),single:()=>{
   if(table==='personnel')return Promise.resolve({data:{phone:'2025550100',applicant_id:'applicant'},error:null});
   if(table==='applicants')return Promise.resolve({data:{sms_opted_out:optedOut},error:null});
   const key=inserted?.kind||kind;if(reservations.has(key))return Promise.resolve({data:null,error:{code:'23505'}});
   reservations.add(key);return Promise.resolve({data:{id:'reservation'},error:null});
  },then:(resolve:any)=>resolve({data:table==='visit_personnel'?[stay]:null,error:null})};return q;
 }};
 return {db:db as unknown as Parameters<typeof scheduledClose>[0],calls,stay};
}
Deno.test('notice uses HHMM frozen scheduled end in the location timezone',()=>{
 assertEquals(autoCloseMessage('2026-11-13T22:00:00Z','America/New_York','/punch/example?extension=1'),'You were clocked out at 1700 per schedule. If you worked later, tap here /punch/example?extension=1');
});
Deno.test('dry run never reserves or sends a worker text',async()=>{
 const {db,calls}=fakeDb();const original=globalThis.fetch;
 globalThis.fetch=()=>{throw new Error('dry run attempted network');};
 try{const result=await scheduledClose(db,true);assertEquals(result.sent,0);assertEquals(calls,[]);}finally{globalThis.fetch=original;}
});
Deno.test('notice deduplicates each auto-close and respects opt-out with mocked delivery only',async()=>{
 const {db,stay}=fakeDb();const original=globalThis.fetch;let sends=0;let body='';
 const names=['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_PHONE_NUMBER'];const previous=names.map(n=>Deno.env.get(n));
 names.forEach(n=>Deno.env.set(n,'test-only'));
 globalThis.fetch=async(_input,init)=>{sends++;body=String(init?.body);return new Response(JSON.stringify({sid:'mock'}),{status:201,headers:{'Content-Type':'application/json'}});};
 try{
  assertEquals((await scheduledClose(db,false)).sent,1);
  assertStringIncludes(new URLSearchParams(body).get('Body')||'','at 1700 per schedule');
  assertStringIncludes(new URLSearchParams(body).get('Body')||'','/punch/private-test-token?extension=1');
  assertEquals((await scheduledClose(db,false)).sent,0);assertEquals(sends,1);
  stay.id='stay-two';assertEquals((await scheduledClose(db,false)).sent,1);assertEquals(sends,2);
  const opted=fakeDb(true);assertEquals((await scheduledClose(opted.db,false)).sent,0);assertEquals(opted.calls,[]);assertEquals(sends,2);
 }finally{globalThis.fetch=original;names.forEach((n,i)=>{const old=previous[i];if(old===undefined)Deno.env.delete(n);else Deno.env.set(n,old);});}
});