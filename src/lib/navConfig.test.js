import { describe, it, expect } from "vitest";
import { sections, isItemVisible, isSectionVisible, isNavItemActive } from "../components/layout/navConfig";

const visibleFor = (admin: boolean, manager: boolean, accounting = false) =>
  sections
    .filter((s) => isSectionVisible(s, admin, manager, accounting))
    .flatMap((s) => s.items.filter((i) => isItemVisible(i, admin, manager, accounting)).map((i) => i.href));

describe("sidebar navigation", () => {
  it("has exactly one entry per destination", () => {
    const all = sections.flatMap((s) => s.items.map((i) => i.href));
    expect(new Set(all).size).toBe(all.length);
  });
  it("field role sees only field tools, no money or workforce admin", () => {
    expect(visibleFor(false, false).sort()).toEqual(["/", "/messages", "/projects", "/reimbursements", "/time-tracking"].sort());
  });
  it("accounting sees financials but not workforce", () => {
    const v = visibleFor(false, false, true);
    expect(v).toContain("/invoices");
    expect(v).not.toContain("/personnel");
  });
  it("Bench and Personnel never highlight together", () => {
    expect(isNavItemActive("/personnel?segment=bench", "/personnel", "?segment=bench")).toBe(true);
    expect(isNavItemActive("/personnel", "/personnel", "?segment=bench")).toBe(false);
    expect(isNavItemActive("/personnel", "/personnel/abc", "")).toBe(true);
  });
});
