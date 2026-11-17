import type { StorageAdapter } from "../types.js";
import { cacheApiAdapter } from "./cache-api.js";
import { indexedDbAdapter } from "./indexeddb.js";
import { opfsAdapter } from "./opfs.js";

export { cacheApiAdapter, indexedDbAdapter, opfsAdapter };
export type { CacheApiAdapterOptions } from "./cache-api.js";
export type { IndexedDbAdapterOptions } from "./indexeddb.js";
export type { OpfsAdapterOptions } from "./opfs.js";

/** The three built-in adapters with their default names. */
export function defaultAdapters(): StorageAdapter[] {
  return [cacheApiAdapter(), indexedDbAdapter(), opfsAdapter()];
}
