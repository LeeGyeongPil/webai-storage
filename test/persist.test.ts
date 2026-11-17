import { describe, expect, it } from "vitest";
import { requestPersist } from "../src/index.js";
import { createFakeStorageManager } from "../src/testing/index.js";

describe("requestPersist (AC-6)", () => {
  it("does not call persist() when already persisted", async () => {
    const storage = createFakeStorageManager({ persisted: true });
    expect(await requestPersist({ env: { storage } })).toEqual({ supported: true, persistedBefore: true, granted: true });
    expect(storage.persistCalls).toBe(0);
  });

  it("returns granted false without throwing when the browser refuses", async () => {
    const storage = createFakeStorageManager({ persisted: false, grant: false });
    expect(await requestPersist({ env: { storage } })).toEqual({ supported: true, persistedBefore: false, granted: false });
    expect(storage.persistCalls).toBe(1);
  });

  it("returns granted true when the browser accepts", async () => {
    const storage = createFakeStorageManager({ grant: true });
    expect(await requestPersist({ env: { storage } })).toEqual({ supported: true, persistedBefore: false, granted: true });
  });

  it("reports supported false without a StorageManager", async () => {
    expect(await requestPersist({ env: {} })).toEqual({ supported: false, persistedBefore: null, granted: null });
  });

  it("treats a throwing persist() as a refusal", async () => {
    const storage = {
      persisted: async () => false,
      persist: async () => {
        throw new Error("denied");
      },
    } as unknown as StorageManager;
    expect(await requestPersist({ env: { storage } })).toEqual({ supported: true, persistedBefore: false, granted: false });
  });
});
