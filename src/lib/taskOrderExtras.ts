import { formatLocalDate } from './dateUtils';
export type DetailRow = { id: string; label: string; value: string };
export const isDemob = (kind: string) => kind === 'decrease' || kind === 'demobilization';
export function detailEntries(details: unknown): [string, string][] {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return [];
  return Object.entries(details).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
}
export function buildDetails(rows: DetailRow[]): Record<string, string> | null {
  const entries = rows.filter(r => r.label.trim() || r.value.trim()).map(r => [r.label.trim(), r.value.trim()]);
  if (entries.some(([label, value]) => !label || !value)) throw new Error('Complete each additional-info label and value');
  if (new Set(entries.map(([label]) => label)).size !== entries.length) throw new Error('Additional-info labels must be unique');
  return entries.length ? Object.fromEntries(entries) : null;
}
export function taskOrderWhen(day: string, time?: string | null) {
  return time ? `${formatLocalDate(day, 'M/d')} ${time.slice(0, 5)}` : formatLocalDate(day);
}
export function adjustmentLines(before: {role_label: string; headcount_needed: number}[], after: {role_label: string; headcount_needed: number}[]) {
  const totals = (rows: typeof before) => rows.reduce<Record<string, number>>((out, r) => { out[r.role_label] = (out[r.role_label] ?? 0) + r.headcount_needed; return out; }, {});
  const old = totals(before), next = totals(after);
  return [...new Set([...Object.keys(old), ...Object.keys(next)])].flatMap(label => {
    const qty_delta = (next[label] ?? 0) - (old[label] ?? 0);
    return qty_delta ? [{line_kind: 'position' as const, label, qty_delta, kind: qty_delta > 0 ? 'increase' as const : 'decrease' as const}] : [];
  });
}
export function adjustmentNumber(day: string, time: string) { return `ADJ-${day.replaceAll('-', '')}-${time.slice(0,5).replace(':','')}`; }