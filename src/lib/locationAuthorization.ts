export type AuthorizationLevel = { line_kind: string; label: string; authorized: number };
export type TaskOrderKind = 'initial' | 'increase' | 'decrease' | 'demobilization';
export function taskOrderDelta(kind: TaskOrderKind, quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Quantity must be a positive whole number');
  return kind === 'decrease' || kind === 'demobilization' ? -quantity : quantity;
}
export function authorizedTotal(levels: AuthorizationLevel[], kind: 'position' | 'asset') {
  return levels.filter(l => l.line_kind === kind).reduce((n, l) => n + Number(l.authorized), 0);
}
export function authorizationGap(actual: number, authorized: number) {
  return { under: Math.max(0, authorized - actual), over: Math.max(0, actual - authorized) };
}