/** Pure running-total math and labels for compact task-order history tables, prints and XLSX. */
export type HistoryLine = { label: string; qty_delta: number };
export type HistoryOrder = {
  id: string; number: string; kind: string; effective_date: string; effective_time?: string | null; created_at: string;
  /** Non-accepted orders are listed but never change the running totals. */
  counts: boolean; status?: string | null; scope?: string | null; lines: HistoryLine[];
  customer_ref?: string | null; edited?: string | null; enteredBy?: string; notes?: string | null; travel_time?: boolean | null; details?: Record<string, string> | null;
};
export type Total = { label: string; qty: number };
export type HistoryRow = HistoryOrder & { totals: Total[]; fullDemob: boolean };

const ABBR: Record<string, string> = { supervisor: 'Sup', operator: 'Op', 'forklift operator': 'FL Op', 'general labor': 'GL', 'cdl driver': 'CDL' };
export const shortLabel = (label: string) => ABBR[label.trim().toLowerCase()] ?? label.trim();
export const kindLabel = (kind: string) => ({ initial: 'Mobilization', increase: 'Increase', decrease: 'Decrease', demobilization: 'Demobe' } as Record<string, string>)[kind] ?? kind;
export const formatChanges = (lines: HistoryLine[]) => lines.map(l => `${l.qty_delta > 0 ? '+' : l.qty_delta < 0 ? '−' : ''}${Math.abs(l.qty_delta)} ${shortLabel(l.label)}`).join(', ');
export const formatTotals = (totals: Total[]) => totals.length ? totals.map(t => `${t.qty} ${shortLabel(t.label)}`).join(' / ') : '—';
export const compactTotals = (totals: Total[]) => totals.map(t => t.qty).join('/');

/** Chronological order (date, time, entry), each scope/label floored at zero independently, then aggregated per label. */
export function runningTotals(orders: HistoryOrder[]): HistoryRow[] {
  const sorted = [...orders].sort((a, b) => a.effective_date.localeCompare(b.effective_date) || (a.effective_time ?? '').localeCompare(b.effective_time ?? '') || a.created_at.localeCompare(b.created_at));
  const levels = new Map<string, number>(), labels: string[] = [];
  return sorted.map(o => {
    if (o.counts) for (const l of o.lines) {
      const label = l.label.trim(), norm = label.toLowerCase();
      if (!labels.some(x => x.toLowerCase() === norm)) labels.push(label);
      const key = `${o.scope ?? ''}|${norm}`;
      levels.set(key, Math.max(0, (levels.get(key) ?? 0) + l.qty_delta));
    }
    const totals = labels.map(label => ({ label, qty: [...levels].filter(([k]) => k.endsWith(`|${label.toLowerCase()}`)).reduce((s, [, v]) => s + v, 0) }));
    const fullDemob = o.counts && (o.kind === 'demobilization' || o.kind === 'decrease') && totals.length > 0 && totals.every(t => t.qty === 0);
    return { ...o, totals, fullDemob };
  });
}
