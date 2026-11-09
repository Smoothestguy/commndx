import { describe, it, expect } from 'bun:test';
import { workingDaysInYear, assetCostBreakdown, marginPct, insuranceExpiringSoon } from './assetCost';

describe('asset cost recovery', () => {
  it('2026 has 250 working days (261 weekdays − 11 federal holidays)', () => expect(workingDaysInYear(2026)).toBe(250));
  it('a Saturday New Year observed on Dec 31 counts against the earlier year (2021 had 12 observed weekday holidays)', () => expect(workingDaysInYear(2021)).toBe(249));
  it('owned truck: 60k/5y + 3.6k insurance + 2.4k maintenance → $90.00/day in 2026', () => {
    const b = assetCostBreakdown({ ownership: 'owned', unit_cost: 60000, useful_life_years: 5, salvage_value: 0, insurance_annual_cost: 3600, maintenance_annual_cost: 2400 }, 2026);
    expect(b.depreciation).toBe(12000); expect(b.annualTotal).toBe(18000); expect(b.perDay).toBe(90);
  });
  it('salvage value reduces depreciation', () => expect(assetCostBreakdown({ ownership: 'owned', unit_cost: 60000, useful_life_years: 5, salvage_value: 10000 }, 2026).depreciation).toBe(10000));
  it('rentals convert period without the 25% uplift', () => {
    expect(assetCostBreakdown({ ownership: 'rented', rental_rate: 125, rental_period: 'day' }, 2026).perDay).toBe(125);
    expect(assetCostBreakdown({ ownership: 'rented', rental_rate: 500, rental_period: 'week' }, 2026).perDay).toBe(100);
    expect(assetCostBreakdown({ ownership: 'rented', rental_rate: 2500, rental_period: 'month' }, 2026).perDay).toBe(120);
  });
  it('manual override wins only when flagged', () => {
    expect(assetCostBreakdown({ ownership: 'owned', unit_cost: 60000, daily_cost_override: 75, daily_cost_overridden: true }, 2026).perDay).toBe(75);
    expect(assetCostBreakdown({ ownership: 'owned', unit_cost: 60000, daily_cost_override: 75, daily_cost_overridden: false }, 2026).perDay).toBe(60);
  });
  it('margin compares bill rate to our cost', () => { expect(marginPct(150, 90)).toBe(40); expect(marginPct(80, 90)).toBe(-12.5); expect(marginPct(null, 90)).toBe(null); });
  it('insurance within 30 days is flagged', () => { expect(insuranceExpiringSoon('2026-12-09', '2026-11-09')).toBe(true); expect(insuranceExpiringSoon('2026-12-10', '2026-11-09')).toBe(false); });
});
