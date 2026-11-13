export const CARD_HOLD_MS = 500;
export const CARD_MOVE_TOLERANCE = 10;
export function cancelCardHold(start: { x: number; y: number }, x: number, y: number) {
  return Math.hypot(x - start.x, y - start.y) > CARD_MOVE_TOLERANCE;
}
export function canEditSelection(manager: boolean, count: number) { return manager && count === 1; }