import { describe, it, expect } from "bun:test";
import { splitAtMidnight, resolveShiftStarts, resolveShifts, chicagoMidnight, timesheetSegments } from "./shifts";
it('ends inherit project values then opposite starts, with location end taking precedence',()=>{
  expect(resolveShifts({day_shift_start:'07:30',night_shift_start:'19:30'})).toEqual({day:'07:30',night:'19:30',dayEnd:'19:30',nightEnd:'07:30'});
  expect(resolveShifts({day_shift_end:'17:00'},{day_shift_end:'18:00',night_shift_end:'08:00'})).toMatchObject({dayEnd:'17:00',nightEnd:'08:00'});
});

describe("location shifts and Chicago midnight hours", () => {
  it("location overrides win, then project values, then 06:00 / 18:00", () => {
    expect(resolveShiftStarts({ day_shift_start: "07:00", night_shift_start: "19:00" }, { day_shift_start: "08:00", night_shift_start: "20:00" })).toEqual({ day: "07:00", night: "19:00" });
    expect(resolveShiftStarts({ day_shift_start: null, night_shift_start: null }, { day_shift_start: "08:00", night_shift_start: "20:00" })).toEqual({ day: "08:00", night: "20:00" });
    expect(resolveShiftStarts()).toEqual({ day: "06:00", night: "18:00" });
  });
  it("credits 20:00–04:00 as 4h on each calendar date", () => {
    const s = splitAtMidnight("2026-11-04T20:00:00-06:00", "2026-11-05T04:00:00-06:00");
    expect(s.map((v) => [v.date, v.hours])).toEqual([["2026-11-04", 4], ["2026-11-05", 4]]);
    expect(s[0].outAt).toBe(s[1].inAt);
  });
  it("retains the original night shift even when a later segment starts during day shift", () => {
    const inAt = "2026-11-04T20:00:00-06:00";
    const segments = timesheetSegments(inAt, "2026-11-06T08:00:00-06:00");
    expect(segments.map((s) => s.shift)).toEqual(["night", "night", "night"]);
    expect(segments.map((s) => s.hours)).toEqual([4, 24, 8]);
  });
  it("classifies entries using their location and keeps original in/out for detail export", () => {
    const start = "2026-11-04T07:00:00-06:00";
    const end = "2026-11-05T04:00:00-06:00";
    const segments = timesheetSegments(start, end, { day_shift_start: "08:00" }, { day_shift_start: "06:00" });
    expect(segments.map((s) => s.shift)).toEqual(["night", "night"]);
    expect(segments.map((s) => [s.in_at, s.out_at])).toEqual([[start, end], [start, end]]);
  });
  it("keeps open punches marked and excluded from credited hours", () => {
    expect(timesheetSegments("2026-11-04T20:00:00-06:00", null)[0]).toMatchObject({ date: "2026-11-04", shift: "night", open: true, hours: 0 });
  });
  it("midnight checkout does not add an empty date", () => {
    expect(splitAtMidnight("2026-11-04T20:00:00-06:00", "2026-11-05T00:00:00-06:00").map((s) => [s.date, s.hours])).toEqual([["2026-11-04", 4]]);
  });
  it("uses Chicago midnights through both DST changes", () => {
    expect(splitAtMidnight(chicagoMidnight("2026-03-08"), chicagoMidnight("2026-03-09"))[0].hours).toBe(23);
    expect(splitAtMidnight(chicagoMidnight("2026-11-01"), chicagoMidnight("2026-11-02"))[0].hours).toBe(25);
  });
  it("rejects invalid, reversed, and zero-length stays", () => {
    expect(splitAtMidnight("bad", "bad")).toEqual([]);
    expect(splitAtMidnight("2026-11-04T12:00:00Z", "2026-11-04T11:00:00Z")).toEqual([]);
    expect(splitAtMidnight("2026-11-04T12:00:00Z", "2026-11-04T12:00:00Z")).toEqual([]);
  });
});