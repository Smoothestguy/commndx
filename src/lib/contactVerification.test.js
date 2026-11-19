import { describe, it, expect } from "bun:test";
import { contactsNeedingCode, normalizePhone, normalizeEmail } from "./contactVerification";

describe("contactsNeedingCode", () => {
  it("email link + same email → only phone needs a code", () => {
    expect(contactsNeedingCode("email", { email: "a@b.com", phone: "5551234567" }, { email: " A@B.com", phone: "(555) 123-4567" })).toMatchObject({ email: false, phone: true, emailProven: true });
  });
  it("sms link + same phone → only email needs a code", () => {
    expect(contactsNeedingCode("sms", { email: "a@b.com", phone: "5551234567" }, { email: "a@b.com", phone: "+1 555 123 4567" })).toMatchObject({ email: true, phone: false, phoneProven: true });
  });
  it("changing the link's contact requires a code for it", () => {
    expect(contactsNeedingCode("email", { email: "a@b.com" }, { email: "new@b.com", phone: "5551234567" })).toMatchObject({ email: true, phone: true });
  });
  it("normalizes", () => { expect(normalizePhone("1-555-123-4567")).toBe("5551234567"); expect(normalizeEmail(" X@Y.Z ")).toBe("x@y.z"); });
});
