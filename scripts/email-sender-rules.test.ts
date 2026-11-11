import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (name: string) => readFileSync(`supabase/functions/${name}/index.ts`, 'utf8');
for (const name of ['send-co-approval', 'process-co-signature', 'application-watchdog']) {
  test(`${name} uses the verified operations sender`, () => {
    const code = source(name);
    const senders = [...code.matchAll(/from: "([^"]+)"/g)].map(m => m[1]);
    assert.ok(senders.length > 0);
    for (const sender of senders) assert.equal(sender, 'Fairfield Response Group <admin@fairfieldrg.com>');
  });
}
test('onboarding confirmation uses the verified hiring sender', () => {
  const sender = source('send-onboarding-confirmation-email').match(/from: "([^"]+)"/)?.[1];
  assert.equal(sender, 'Fairfield Response Group <careers@fairfieldrg.com>');
});