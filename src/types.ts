/** Built-in store names. Custom adapters may use any other string. */
export type StoreKind = "cache-api" | "indexeddb" | "opfs" | (string & {});

export type SizeSource =
  | "content-length"
  | "blob"
  | "byteLength"
  | "json-estimate"
  | "opfs-file"
  | "unknown";

/** Browser storage entry points. Defaults to the globals; tests inject fakes. */
export interface StorageEnv {
  caches?: CacheStorage;
  indexedDB?: IDBFactory;
  storage?: StorageManager;
}

/** One stored file (one cache entry, one IndexedDB record or one OPFS file pair). */
export interface Entry {
  url: string;
  store: StoreKind;
  /** Cache name, database name or OPFS directory path. */
  container: string;
  /** Size in bytes, or null when it could not be determined cheaply. */
  bytes: number | null;
  sizeSource: SizeSource;
  /** True when the stored size is smaller than the size the writer announced. */
  partial: boolean;
  /** Adapter-private key needed to delete the entry (for example the OPFS file stem). */
  key?: string;
}

export interface ModelGroup {
  /** Model id such as "Xenova/all-MiniLM-L6-v2", or "(other)" for unrecognised URLs. */
  id: string;
  revision: string | null;
  variants: string[];
  stores: string[];
  files: number;
  bytes: number;
  unknownSizeFiles: number;
  partial: boolean;
  entries: Entry[];
}

export interface EstimateInfo {
  usage?: number;
  quota?: number;
  /** navigator.storage.estimate() is always an approximation. */
  approximate: true;
}

export interface SkippedStore {
  store: StoreKind;
  reason: string;
}

export interface ScanResult {
  entries: Entry[];
  models: ModelGroup[];
  estimate: EstimateInfo | null;
  persisted: boolean | null;
  skipped: SkippedStore[];
}

export interface ListOptions {
  measureUnknown?: boolean;
}

/** Plug in your own store. `list` may throw; the store is then reported in `skipped`. */
export interface StorageAdapter {
  readonly name: StoreKind;
  list(env: StorageEnv, opts: ListOptions): Promise<Entry[]>;
  remove(env: StorageEnv, entry: Entry): Promise<void>;
}

export interface RemoveResult {
  filesDeleted: number;
  bytesFreed: number;
}

export type Verdict = "fits" | "tight" | "insufficient" | "unknown";

export interface Preflight {
  verdict: Verdict;
  needBytes: number;
  alreadyCachedBytes: number;
  freeBytes: number | null;
  quotaBytes: number | null;
  usageBytes: number | null;
  margin: number;
  persisted: boolean | null;
  persistAdvice: "none" | "recommend" | "already";
  approximate: true;
}

export type Lang = "en" | "ko";
