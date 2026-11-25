import { describe, expect, it } from "bun:test";
import { saveCommittedSignature } from "./punchSignatureSave";

describe("saveCommittedSignature", () => {
  it("committed + already signed confirms without saving", async () => {
    let saves = 0;
    expect(await saveCommittedSignature({ online: () => true, isSigned: async () => true, save: async () => { saves++; return true; } })).toBe("signed");
    expect(saves).toBe(0);
  });
  it("save timeout confirms with uploading note", async () => {
    const r = await saveCommittedSignature({ online: () => true, isSigned: async () => false, save: () => new Promise(() => {}), timeoutMs: 20 });
    expect(r).toBe("uploading");
  });
  it("save timeout but server now signed confirms", async () => {
    let n = 0;
    expect(await saveCommittedSignature({ online: () => true, isSigned: async () => n++ > 0, save: () => new Promise(() => {}), timeoutMs: 20 })).toBe("signed");
  });
  it("offline gives no-signal", async () => {
    expect(await saveCommittedSignature({ online: () => false, isSigned: async () => true, save: async () => true })).toBe("offline");
  });
});
