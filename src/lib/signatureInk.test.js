import { it, expect } from 'bun:test';
import { clearWhitePixels } from './signatureInk';
it('removes only near-white paper and retains dark ink and existing transparency', () => {
  const pixels = new Uint8ClampedArray([255,255,255,255,236,240,250,255,26,26,166,255,235,255,255,255,20,20,20,80]);
  expect([...clearWhitePixels(pixels)]).toEqual([255,255,255,0,236,240,250,0,26,26,166,255,235,255,255,255,20,20,20,80]);
});