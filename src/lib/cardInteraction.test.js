import { describe, expect, test } from 'bun:test';
import { CARD_HOLD_MS, cancelCardHold, canEditSelection } from './cardInteraction';
describe('card interactions', () => {
  test('hold threshold is 500ms', () => expect(CARD_HOLD_MS).toBe(500));
  test('scroll-sized movement cancels hold', () => { expect(cancelCardHold({x:0,y:0},0,11)).toBe(true); expect(cancelCardHold({x:0,y:0},0,5)).toBe(false); });
  test('single selection alone can be edited', () => { expect(canEditSelection(true,1)).toBe(true); expect(canEditSelection(true,2)).toBe(false); });
  test('field selection cannot edit', () => expect(canEditSelection(false,1)).toBe(false));
});