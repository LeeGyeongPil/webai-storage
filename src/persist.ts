import { defaultEnv } from "./env.js";
import type { StorageEnv } from "./types.js";

export interface PersistResult {
  supported: boolean;
  persistedBefore: boolean | null;
  granted: boolean | null;
}

/**
 * Ask the browser for persistent storage, but only when it is not persistent already.
 * A refusal is a normal answer (the browser decides on its own), not an error.
 */
export async function requestPersist(opts: { env?: StorageEnv } = {}): Promise<PersistResult> {
  const storage = (opts.env ?? defaultEnv()).storage;
  if (!storage || typeof storage.persist !== "function") {
    return { supported: false, persistedBefore: null, granted: null };
  }
  let before = false;
  try {
    if (typeof storage.persisted === "function") before = await storage.persisted();
  } catch {
    before = false;
  }
  if (before) return { supported: true, persistedBefore: true, granted: true };
  try {
    return { supported: true, persistedBefore: false, granted: (await storage.persist()) === true };
  } catch {
    return { supported: true, persistedBefore: false, granted: false };
  }
}
