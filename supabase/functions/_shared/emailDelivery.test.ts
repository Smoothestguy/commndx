import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportEmailRejection, recordEmailFailure } from './emailDelivery.ts';

test('successful delivery does not create a failure record', async () => {
  let records = 0;
  assert.equal(await reportEmailRejection(new Response('{"id":"test"}'), 'test', async () => { records++; return {}; }), null);
  assert.equal(records, 0);
});

test('rejection records exact HTTP status and provider error without changing workflow', async () => {
  const records: string[] = [];
  const detail = await reportEmailRejection(new Response('{"message":"Domain is not verified"}', { status: 403 }), 'test', async value => { records.push(value); return {}; });
  assert.equal(detail, 'Resend HTTP 403: {"message":"Domain is not verified"}');
  assert.deepEqual(records, [detail]);
});

test('failed audit write remains nonblocking and is visible in console', async () => {
  const logs: string[] = [];
  const original = console.error;
  console.error = (...values) => { logs.push(values.join(' ')); };
  try {
    await recordEmailFailure('test', 'Resend HTTP 422', async () => ({ error: { message: 'audit unavailable' } }));
    assert.equal(logs.length, 2);
    assert.match(logs[1], /audit unavailable/);
  } finally { console.error = original; }
});