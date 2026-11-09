/** Internal owned/rented asset cost-recovery math. Manager/admin-only data; never render for field/portal/exports. */
export const IDLE_UPLIFT = 1.25;

export interface AssetCostInputs {
  ownership?: string | null;
  unit_cost?: number | null; useful_life_years?: number | null; salvage_value?: number | null;
  insurance_annual_cost?: number | null; registration_annual_cost?: number | null; maintenance_annual_cost?: number | null;
  financing_annual_cost?: number | null; other_annual_cost?: number | null;
  rental_rate?: number | null; rental_period?: string | null;
  daily_cost_override?: number | null; daily_cost_overridden?: boolean | null;
  insurance_expires_on?: string | null;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dow = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
const nthWeekday = (y: number, m: number, wd: number, n: number) => { const first = dow(y, m, 1); return 1 + ((wd - first + 7) % 7) + (n - 1) * 7; };
const lastWeekday = (y: number, m: number, wd: number) => { const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return last - ((dow(y, m, last) - wd + 7) % 7); };
/** Fixed-date holidays on Saturday are observed Friday, Sunday → Monday (OPM rule). */
const observed = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d)); const w = t.getUTCDay();
  if (w === 6) t.setUTCDate(t.getUTCDate() - 1); else if (w === 0) t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

/** Observed US federal holidays (11) for holiday-year y; an observed date may fall in y-1 (New Year's on Saturday). */
export function federalHolidays(y: number): string[] {
  return [
    observed(y, 1, 1), iso(y, 1, nthWeekday(y, 1, 1, 3)), iso(y, 2, nthWeekday(y, 2, 1, 3)), iso(y, 5, lastWeekday(y, 5, 1)),
    observed(y, 6, 19), observed(y, 7, 4), iso(y, 9, nthWeekday(y, 9, 1, 1)), iso(y, 10, nthWeekday(y, 10, 1, 2)),
    observed(y, 11, 11), iso(y, 11, nthWeekday(y, 11, 4, 4)), observed(y, 12, 25),
  ];
}

/** Days in year minus weekends minus observed federal holidays falling on weekdays of that year. */
export function workingDaysInYear(y: number): number {
  const hol = new Set([...federalHolidays(y), ...federalHolidays(y + 1)].filter(d => d.startsWith(`${y}-`)));
  let n = 0;
  for (let t = Date.UTC(y, 0, 1); new Date(t).getUTCFullYear() === y; t += 86400000) {
    const d = new Date(t); const w = d.getUTCDay();
    if (w !== 0 && w !== 6 && !hol.has(d.toISOString().slice(0, 10))) n++;
  }
  return n;
}

const num = (v: number | null | undefined) => (v == null || !Number.isFinite(Number(v)) ? 0 : Number(v));
const round2 = (v: number) => Math.round(v * 100) / 100;

export interface AssetCostBreakdown {
  kind: 'owned' | 'rented';
  depreciation: number; insurance: number; registration: number; maintenance: number; financing: number; other: number;
  annualTotal: number; workingDays: number; uplift: number;
  computed: number | null; overridden: boolean; perDay: number | null;
}

export function assetCostBreakdown(a: AssetCostInputs, year = new Date().getFullYear()): AssetCostBreakdown {
  const workingDays = workingDaysInYear(year);
  const overridden = !!a.daily_cost_overridden && a.daily_cost_override != null;
  const zero = { depreciation: 0, insurance: 0, registration: 0, maintenance: 0, financing: 0, other: 0, annualTotal: 0 };
  if (a.ownership === 'rented') {
    const r = a.rental_rate == null ? null : num(a.rental_rate);
    const computed = r == null ? null : round2(a.rental_period === 'week' ? r / 5 : a.rental_period === 'month' ? (r * 12) / workingDays : r);
    return { kind: 'rented', ...zero, workingDays, uplift: 1, computed, overridden, perDay: overridden ? num(a.daily_cost_override) : computed };
  }
  const life = num(a.useful_life_years) > 0 ? num(a.useful_life_years) : 5;
  const depreciation = a.unit_cost == null ? 0 : Math.max(0, num(a.unit_cost) - num(a.salvage_value)) / life;
  const parts = { depreciation, insurance: num(a.insurance_annual_cost), registration: num(a.registration_annual_cost), maintenance: num(a.maintenance_annual_cost), financing: num(a.financing_annual_cost), other: num(a.other_annual_cost) };
  const annualTotal = Object.values(parts).reduce((s, v) => s + v, 0);
  const computed = annualTotal > 0 ? round2((annualTotal / workingDays) * IDLE_UPLIFT) : null;
  return { kind: 'owned', ...parts, annualTotal, workingDays, uplift: IDLE_UPLIFT, computed, overridden, perDay: overridden ? num(a.daily_cost_override) : computed };
}

/** (bill − cost) / bill as a percent; null when either side is missing or bill is 0. */
export function marginPct(billPerDay: number | null | undefined, costPerDay: number | null | undefined): number | null {
  if (billPerDay == null || costPerDay == null || !(Number(billPerDay) > 0)) return null;
  return Math.round(((Number(billPerDay) - Number(costPerDay)) / Number(billPerDay)) * 1000) / 10;
}

/** True when insurance expires within `days` days of `today` (YYYY-MM-DD), including already expired. */
export function insuranceExpiringSoon(expires: string | null | undefined, today: string, days = 30): boolean {
  if (!expires) return false;
  const diff = (Date.parse(`${expires}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  return diff <= days;
}
