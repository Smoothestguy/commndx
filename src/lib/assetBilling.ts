// Per-diem equipment billing. Effective rate = assignment.day_rate ?? asset.default_day_rate.
// Billable days = inclusive calendar days from start to (end ?? today), capped at 365.

const MAX_DAYS = 365;

function dayNum(v: string | Date): number {
  const d = typeof v === "string" ? new Date(v) : v;
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export function assetBillableDays(startAt: string, endAt: string | null | undefined, today: Date = new Date()): number {
  const days = dayNum(endAt ?? today) - dayNum(startAt) + 1;
  return Math.max(0, Math.min(MAX_DAYS, days));
}

export function effectiveDayRate(dayRate: number | null | undefined, defaultRate: number | null | undefined): number | null {
  if (dayRate != null) return Number(dayRate);
  if (defaultRate != null) return Number(defaultRate);
  return null;
}

export interface AssetAccrual { days: number; rate: number | null; accrued: number | null }

/** accrued is null when billable but no rate (show "no rate", never guess); 0 when not billable. */
export function assetAccrual(a: {
  billable: boolean; start_at: string; end_at: string | null; day_rate: number | null; default_day_rate: number | null;
}, today: Date = new Date()): AssetAccrual {
  const days = assetBillableDays(a.start_at, a.end_at, today);
  const rate = effectiveDayRate(a.day_rate, a.default_day_rate);
  if (!a.billable) return { days, rate, accrued: 0 };
  return { days, rate, accrued: rate == null ? null : days * rate };
}

export const fmtMoney0 = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
