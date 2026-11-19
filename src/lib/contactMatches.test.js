import { describe, it, expect } from "bun:test";
import { matchesBlock } from "./contactMatches";
const m = (reasons) => ({ entity_type: "personnel", entity_id: "x", full_name: "A", ref_number: null, email: null, phone: null, created_at: "", reasons });
describe("matchesBlock", () => {
  it("same email blocks", () => expect(matchesBlock([m(["same_email"])])).toBe(true));
  it("same phone only warns", () => expect(matchesBlock([m(["same_phone"])])).toBe(false));
  it("similar name only warns", () => expect(matchesBlock([m(["similar_name"])])).toBe(false));
});
