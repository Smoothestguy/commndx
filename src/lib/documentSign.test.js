import { it, expect } from 'bun:test';
import { canSendSignatures, signatureExpired, validSignaturePng } from '../../supabase/functions/document-sign/rules';
it('only admin manager user roles can send signature requests', () => {
  for (const role of ['admin','manager','user']) expect(canSendSignatures([role])).toBe(true);
  for (const role of ['personnel','vendor','accounting']) expect(canSendSignatures([role])).toBe(false);
  expect(canSendSignatures([])).toBe(false);
});
it('expired tokens are rejected at their expiry boundary', () => {
  expect(signatureExpired('2026-12-05T00:00:00Z', Date.parse('2026-12-05T00:00:00Z'))).toBe(true);
  expect(signatureExpired('2026-12-05T00:00:00Z', Date.parse('2026-12-04T23:59:59Z'))).toBe(false);
});
it('PNG signatures cap at 200KB and require the PNG magic', () => {
  const png = new Uint8Array(204800); png.set([137,80,78,71,13,10,26,10]);
  expect(validSignaturePng(png)).toBe(true);
  const large = new Uint8Array(204801); large.set(png);
  expect(validSignaturePng(large)).toBe(false);
  expect(validSignaturePng(new Uint8Array(100))).toBe(false);
});
