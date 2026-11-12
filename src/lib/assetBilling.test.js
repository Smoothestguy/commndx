import { describe, it, expect } from "bun:test";
import { assetAccrual, assetBillableDays, effectiveDayRate } from "./assetBilling";

const today = new Date(2026, 10, 12, 15, 0); // Nov 12 2026 local

describe("asset per-diem billing", () => {
  it("counts inclusive days from start to today when open", () => {
    expect(assetBillableDays(new Date(2026, 10, 1, 9).toISOString(), null, today)).toBe(12);
  });
  it("counts inclusive days to end_at when ended", () => {
    expect(assetBillableDays(new Date(2026, 10, 1, 9).toISOString(), new Date(2026, 10, 1, 17).toISOString(), today)).toBe(1);
  });
  it("caps at 365 days", () => {
    expect(assetBillableDays(new Date(2024, 0, 1).toISOString(), null, today)).toBe(365);
  });
  it("assignment day_rate overrides asset default", () => {
    expect(effectiveDayRate(300, 450)).toBe(300);
    expect(effectiveDayRate(null, 450)).toBe(450);
  });
  it("accrued = days x effective rate ($450 x 12d = $5,400)", () => {
    const r = assetAccrual({ billable: true, start_at: new Date(2026, 10, 1).toISOString(), end_at: null, day_rate: null, default_day_rate: 450 }, today);
    expect(r.accrued).toBe(5400);
  });
  it("billable with no rate gives null (no guessing)", () => {
    const r = assetAccrual({ billable: true, start_at: new Date(2026, 10, 1).toISOString(), end_at: null, day_rate: null, default_day_rate: null }, today);
    expect(r.accrued).toBeNull();
  });
  it("non-billable accrues 0", () => {
    const r = assetAccrual({ billable: false, start_at: new Date(2026, 10, 1).toISOString(), end_at: null, day_rate: 100, default_day_rate: null }, today);
    expect(r.accrued).toBe(0);
  });
  it('both corrected truck billing periods recalculate inclusive days and accrual', () => {
    expect(assetAccrual({ billable:true, start_at:'2026-11-04T13:00:00Z', end_at:'2026-11-11T22:00:00Z', day_rate:90, default_day_rate:null },today)).toEqual({days:8,rate:90,accrued:720});
    expect(assetAccrual({ billable:true, start_at:'2026-11-02T13:00:00Z', end_at:'2026-11-06T22:00:00Z', day_rate:90, default_day_rate:null },today)).toEqual({days:5,rate:90,accrued:450});
  });
});
