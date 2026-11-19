import { test, expect } from 'bun:test';
import { revokeOlderOnboardingTokens } from '../../supabase/functions/_shared/onboardingTokenCleanup.ts';
import { pendingAlertCandidates } from '../../supabase/functions/_shared/onboardingAlertCandidates.ts';

test('token cleanup excludes the new, used, revoked and other-person tokens', async()=>{
 const calls=[]; const q={update(v){calls.push(['update',v]);return q},eq(...v){calls.push(['eq',...v]);return q},neq(...v){calls.push(['neq',...v]);return q},is(...v){calls.push(['is',...v]);return q},then(ok){return Promise.resolve({error:null}).then(ok)}};
 await revokeOlderOnboardingTokens({from(t){calls.push(['from',t]);return q}},'person','new','2026-11-19T16:00:00Z');
 expect(calls).toEqual([['from','personnel_onboarding_tokens'],['update',{revoked_at:'2026-11-19T16:00:00Z'}],['eq','personnel_id','person'],['neq','id','new'],['is','used_at',null],['is','revoked_at',null]]);
});
test('empty monitor selects only unalerted terminal and live 24-hour unopened rows in parallel', async()=>{
 const queries=[];const db={from(table){const calls=[['from',table]];queries.push(calls);const q=new Proxy({}, {get(_,key){if(key==='then')return ok=>Promise.resolve({data:[],error:null}).then(ok);return (...args)=>{calls.push([key,...args]);return q}}});return q}};
 const start=performance.now();expect(await pendingAlertCandidates(db,Date.parse('2026-11-19T16:00:00Z'))).toEqual([]);expect(performance.now()-start).toBeLessThan(5000);
 expect(queries).toHaveLength(2);
 expect(queries[0]).toContainEqual(['in','final_status',['bounced','complained','failed']]);expect(queries[0]).toContainEqual(['is','email_keys',null]);
 expect(queries[1]).toContainEqual(['lte','sent_at','2026-11-18T16:00:00.000Z']);expect(queries[1]).toContainEqual(['gt','token.expires_at','2026-11-19T16:00:00.000Z']);
 for(const field of ['token.used_at','token.revoked_at','token.first_opened_at','token.not_opened'])expect(queries[1]).toContainEqual(['is',field,null]);
});