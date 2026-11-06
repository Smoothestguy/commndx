import { expect, test } from 'bun:test';
import { inkBounds, clearWhitePixels } from './signatureInk';
const img = (w, h, ink) => { const p = new Uint8ClampedArray(w * h * 4).fill(255); for (const [x, y] of ink) p.set([0, 0, 0, 255], (y * w + x) * 4); return clearWhitePixels(p); };
test('white paper becomes transparent and the crop hugs the ink', () => {
  expect(inkBounds(img(100, 50, [[40, 20], [60, 30]]), 100, 50, 2)).toEqual({ x: 38, y: 18, width: 25, height: 15 });
});
test('blank pad has no ink', () => { expect(inkBounds(img(10, 10, []), 10, 10)).toBeNull(); });
