import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECK_WINDOW_MS, UNOPENED_MS, deliveryEvent, retrieveDelivery } from '../../supabase/functions/_shared/onboardingDelivery.ts';
test('72-hour retrieval window', () => assert.equal(CHECK_WINDOW_MS, 259200000));
test('24-hour unopened threshold', () => assert.equal(UNOPENED_MS, 86400000));
for (const event of ['bounced', 'complained', 'failed']) test(`${event} is terminal`, () => assert.equal(deliveryEvent(`email.${event}`).final, event));
test('delivered remains checkable for later complaints', () => assert.equal(deliveryEvent('delivered').final, null));
test('missing status silently skipped', async () => assert.equal(await retrieveDelivery('fixture', 'mock', async () => Response.json({})), null));
test('mock Resend retrieves the sent ID', async () => {
 let called;
 const result = await retrieveDelivery('fixture-id', 'mock', async (url) => { called = url; return Response.json({ last_event: 'bounced' }); });
 assert.equal(called, 'https://api.resend.com/emails/fixture-id'); assert.equal(result.final, 'bounced');
});
test('provider failures retain status and details', async () => { await assert.rejects(retrieveDelivery('fixture','mock',async()=>new Response('invalid key',{status:401})), /Resend \[401\]: invalid key/); });
