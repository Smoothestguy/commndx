import { describe, it, expect } from "bun:test";
import { formatApplicantLocation, missingApplicantZips, withZipLocation } from "./applicantLocation";

describe("applicant location rules", () => {
  it("appends ZIP with a space after city and state", () => {
    expect(formatApplicantLocation({ city: "Houston", state: "TX", home_zip: "77040" })).toBe("Houston, TX 77040");
  });
  it("shows only ZIP when city or state is missing", () => {
    expect(formatApplicantLocation({ city: "Houston", state: null, home_zip: "77040" })).toBe("77040");
  });
  it("shows an em dash when nothing is available", () => {
    expect(formatApplicantLocation(null)).toBe("—");
  });
  it("collects only missing locations and deduplicates ZIPs", () => {
    expect(missingApplicantZips([
      { city: "Houston", state: "TX", home_zip: "77040" },
      { city: null, state: null, home_zip: "02108" },
      { city: null, state: "MA", home_zip: "02108" },
      { city: null, state: null, home_zip: null },
    ])).toEqual(["02108"]);
  });
  it("fills missing fields without overwriting stored values or mutating records", () => {
    const applicant = { city: "Custom city", state: null, home_zip: "02108" };
    expect(withZipLocation(applicant, { "02108": { city: "Boston", state: "MA" } })).toEqual({ city: "Custom city", state: "MA", home_zip: "02108" });
    expect(applicant.state).toBeNull();
  });
  it("preserves unknown ZIPs without inventing a location", () => {
    expect(formatApplicantLocation(withZipLocation({ home_zip: "00000" }, {}))).toBe("00000");
  });
});