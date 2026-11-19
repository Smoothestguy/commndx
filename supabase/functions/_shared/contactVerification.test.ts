import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { normalizeContact, hashCode, codeMessage, MAX_ATTEMPTS, MAX_SENDS_PER_HOUR, CODE_TTL_MS } from './contactVerification.ts';
Deno.test('limits match owner rules', () => { assertEquals(MAX_ATTEMPTS, 5); assertEquals(MAX_SENDS_PER_HOUR, 3); assertEquals(CODE_TTL_MS, 600000); });
Deno.test('phone normalizes to last 10 digits', () => { assertEquals(normalizeContact('phone', '+1 (555) 123-4567'), '5551234567'); assertEquals(normalizeContact('phone', '12345'), null); });
Deno.test('email lower/trim', () => assertEquals(normalizeContact('email', '  Foo@Bar.COM '), 'foo@bar.com'));
Deno.test('hash depends on id and code', async () => { assertNotEquals(await hashCode('a', '123456'), await hashCode('b', '123456')); assertNotEquals(await hashCode('a', '123456'), '123456'); });
Deno.test('bilingual message', () => { const m = codeMessage('123456'); assertEquals(m.includes('Expires in 10 minutes'), true); assertEquals(m.includes('Vence en 10 minutos'), true); });
