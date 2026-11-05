import { expect, it } from 'bun:test';
import { PDFDocument, degrees } from 'pdf-lib';
import { newSignField, stampRect, stampDocument, stampedDate } from './documentStamp';
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')).buffer;
const evidence = { name: 'Test Signer', signedAt: '2026-11-05T13:42:00Z', documentName: 'Test.pdf', projectName: 'Test', reference: 'test' };
it('defaults to 25 percent page width and stores top-origin placement', () => {
  const field = newSignField(2, 120, 160, 600, 800, 'signature');
  expect(field.page).toBe(2); expect(field.w_pct).toBe(0.25); expect(field.x_pct).toBe(0.2); expect(field.y_pct).toBe(0.2);
});
it('converts top-origin y to bottom-left without flipping the signature', () => {
  expect(stampRect({ x_pct: 0.2, y_pct: 0.25, w_pct: 0.25 }, 600, 800, 3)).toEqual({ x: 120, y: 550, width: 150, height: 50 });
});
it('formats the requested numeric date and Chicago 24-hour time', () => { expect(stampedDate('2026-11-05T13:42:00Z')).toBe('11/5/2026 07:42 CT'); });
it('keeps zero-field originals and appends the certificate', async () => {
  const original = await PDFDocument.create(); original.addPage([600, 800]);
  const bytes = await stampDocument((await original.save()).buffer, png, [], evidence);
  const pdf = await PDFDocument.load(bytes); expect(pdf.getPageCount()).toBe(2); expect(pdf.getPage(0).getSize()).toEqual({ width: 600, height: 800 });
});
it('stamps the original page and keeps its rotation plus certificate', async () => {
  const original = await PDFDocument.create(); original.addPage([600, 800]).setRotation(degrees(90));
  const bytes = await stampDocument((await original.save()).buffer, png, [{ id: 'test', page: 1, x_pct: 0.2, y_pct: 0.3, w_pct: 0.25, kind: 'signature' }], evidence);
  const pdf = await PDFDocument.load(bytes); expect(pdf.getPageCount()).toBe(2); expect(pdf.getPage(0).getRotation().angle).toBe(90); expect(pdf.getPage(0).node.Resources().lookupMaybe('XObject')).toBeDefined();
});
it('rejects a field on a nonexistent page rather than silently missing a signature', async () => {
  const original = await PDFDocument.create(); original.addPage();
  expect(stampDocument((await original.save()).buffer, png, [{ id: 'test', page: 2, x_pct: 0, y_pct: 0, w_pct: 0.25, kind: 'signature' }], evidence)).rejects.toThrow('outside the PDF');
});