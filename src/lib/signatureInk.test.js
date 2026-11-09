import { expect, test } from 'bun:test';
import { inkBounds, clearWhitePixels } from './signatureInk';
const img = (w, h, ink) => { const p = new Uint8ClampedArray(w * h * 4).fill(255); for (const [x, y] of ink) p.set([0, 0, 0, 255], (y * w + x) * 4); return clearWhitePixels(p); };
test('white paper becomes transparent and the crop hugs the ink', () => {
  expect(inkBounds(img(100, 50, [[40, 20], [60, 30]]), 100, 50, 2)).toEqual({ x: 38, y: 18, width: 25, height: 15 });
});
test('blank pad has no ink', () => { expect(inkBounds(img(10, 10, []), 10, 10)).toBeNull(); });
import { fitSignatureInCell } from './signatureInk';
test('wide signature fills 90% of cell width, centered, inside borders', () => {
  const r = fitSignatureInCell({ x: 100, y: 200, width: 92, height: 30 }, { width: 400, height: 50 });
  expect(r.width).toBeCloseTo(82.8); expect(r.x + r.width / 2).toBeCloseTo(146); expect(r.y + r.height / 2).toBeCloseTo(215);
  expect(r.x).toBeGreaterThan(100); expect(r.y).toBeGreaterThan(200); expect(r.x + r.width).toBeLessThan(192); expect(r.y + r.height).toBeLessThan(230);
});
test('tall signature is bound by 90% of cell height', () => {
  const r = fitSignatureInCell({ x: 0, y: 0, width: 92, height: 30 }, { width: 50, height: 50 });
  expect(r.height).toBeCloseTo(27); expect(r.x).toBeCloseTo(32.5); expect(r.y).toBeCloseTo(1.5);
});
