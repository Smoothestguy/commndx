import { describe, it, expect } from "bun:test";
import { sortStarredFirst, sortStarredBlocks } from "./applicantStar";

describe("applicant starring sort", () => {
  it("puts starred first, newest star first, rest keep order", () => {
    const rows = [
      { id: "a", starred_at: null },
      { id: "b", starred_at: "2026-01-01T00:00:00Z" },
      { id: "c", starred_at: null },
      { id: "d", starred_at: "2026-02-01T00:00:00Z" },
    ];
    expect(sortStarredFirst(rows, (r) => r).map((r) => r.id)).toEqual(["d", "b", "a", "c"]);
  });
  it("keeps chosen column sort secondary within each block", () => {
    const rows = [
      { id: "z", n: 3, starred_at: null },
      { id: "y", n: 2, starred_at: "x" },
      { id: "x", n: 1, starred_at: null },
      { id: "w", n: 4, starred_at: "x" },
    ];
    expect(sortStarredBlocks(rows, (r) => r, (a, b) => a.n - b.n).map((r) => r.id)).toEqual(["y", "w", "x", "z"]);
  });
});
