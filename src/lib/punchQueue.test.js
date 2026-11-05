import { describe, it, expect } from "bun:test";
import { readPunch, savePunch, clearPunch, withPunchLock, isNetworkError } from "./punchQueue";
import { geoCoordinates, geoMapHref } from "./geoTag";

const items = new Map();
globalThis.localStorage = { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => items.set(k, v), removeItem: (k) => items.delete(k) };
describe("durable site punch", () => {
  it("retains original timestamp and GPS across readback and clears only the matching token", () => {
    const intent = { token: "one", lat: 28.5383, lng: -81.3792, accuracy: 12, overrideReason: 'Working beside the entrance', at: "2026-11-04T21:47:00-06:00", tries: 0, action: "in" };
    savePunch(intent);
    expect(readPunch("one")).toEqual(intent);
    expect(readPunch("two")).toBeNull();
    clearPunch("one");
    expect(readPunch("one")).toBeNull();
  });
  it("does not run simultaneous sends for the same token", async () => {
    let release;
    const wait = new Promise((r) => { release = r; });
    let sends = 0;
    const first = withPunchLock("same", async () => { sends++; await wait; });
    await withPunchLock("same", async () => { sends++; });
    release(); await first;
    expect(sends).toBe(1);
  });
  it("retries network failures but not database permission errors", () => {
    expect(isNetworkError({ message: "TypeError: Failed to fetch" })).toBe(true);
    expect(isNetworkError({ message: "permission denied", code: "42501" })).toBe(false);
  });
  it("shows valid zero coordinates and never substitutes GPS when missing", () => {
    expect(geoCoordinates(0, 0)).toBe("0.0000, 0.0000");
    expect(geoCoordinates(null, -81)).toBeNull();
    expect(geoCoordinates(91, 0)).toBeNull();
    expect(geoMapHref(28.5383, -81.3792)).toBe("https://maps.google.com/?q=28.5383,-81.3792");
  });
});