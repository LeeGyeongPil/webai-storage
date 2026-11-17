import type { StorageEnv } from "./types.js";

/** Resolve the browser globals lazily so importing the library never touches them. */
export function defaultEnv(): StorageEnv {
  const g = globalThis as {
    caches?: CacheStorage;
    indexedDB?: IDBFactory;
    navigator?: { storage?: StorageManager };
  };
  return { caches: g.caches, indexedDB: g.indexedDB, storage: g.navigator?.storage };
}
