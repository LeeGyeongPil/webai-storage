/**
 * In-memory fakes of the browser storage APIs, for tests and demos. They follow the
 * WHATWG interfaces closely enough for this library (and your own code) to run in Node.
 */
import type { StorageEnv } from "../types.js";

// ---------------------------------------------------------------- Cache API

interface StoredResponse {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: ArrayBuffer;
}

function keyOf(request: RequestInfo | URL): string {
  if (typeof request === "string") return new URL(request).href;
  if (request instanceof URL) return request.href;
  return request.url;
}

class FakeCache {
  private readonly items = new Map<string, StoredResponse>();

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const body = await response.arrayBuffer();
    this.items.set(keyOf(request), {
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers.entries()],
      body,
    });
  }

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const item = this.items.get(keyOf(request));
    if (!item) return undefined;
    return new Response(item.body, { status: item.status, statusText: item.statusText, headers: item.headers });
  }

  async keys(): Promise<Request[]> {
    return [...this.items.keys()].map((url) => new Request(url));
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.items.delete(keyOf(request));
  }
}

/** Fake `CacheStorage` (`caches`). */
export function createFakeCacheStorage(): CacheStorage {
  const caches = new Map<string, FakeCache>();
  const fake = {
    async open(name: string) {
      let c = caches.get(name);
      if (!c) {
        c = new FakeCache();
        caches.set(name, c);
      }
      return c;
    },
    async has(name: string) {
      return caches.has(name);
    },
    async delete(name: string) {
      return caches.delete(name);
    },
    async keys() {
      return [...caches.keys()];
    },
    async match(request: RequestInfo | URL) {
      for (const c of caches.values()) {
        const hit = await c.match(request);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  return fake as unknown as CacheStorage;
}

// --------------------------------------------------------------------- OPFS

function notFound(name: string): Error {
  const e = new Error(`A requested file or directory could not be found: ${name}`);
  e.name = "NotFoundError";
  return e;
}

class FakeFileHandle {
  readonly kind = "file" as const;
  data: Uint8Array = new Uint8Array(0);
  constructor(readonly name: string) {}

  async getFile(): Promise<File> {
    return new File([this.data as BlobPart], this.name);
  }

  async createWritable() {
    const handle = this;
    return {
      async write(chunk: string | Uint8Array) {
        handle.data = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk.slice();
      },
      async close() {},
    };
  }
}

class FakeDirectoryHandle {
  readonly kind = "directory" as const;
  private readonly children = new Map<string, FakeFileHandle | FakeDirectoryHandle>();
  constructor(readonly name: string) {}

  async getDirectoryHandle(name: string, opts: { create?: boolean } = {}): Promise<FakeDirectoryHandle> {
    const hit = this.children.get(name);
    if (hit instanceof FakeDirectoryHandle) return hit;
    if (hit || !opts.create) throw notFound(name);
    const dir = new FakeDirectoryHandle(name);
    this.children.set(name, dir);
    return dir;
  }

  async getFileHandle(name: string, opts: { create?: boolean } = {}): Promise<FakeFileHandle> {
    const hit = this.children.get(name);
    if (hit instanceof FakeFileHandle) return hit;
    if (hit || !opts.create) throw notFound(name);
    const file = new FakeFileHandle(name);
    this.children.set(name, file);
    return file;
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.children.delete(name)) throw notFound(name);
  }

  async *entries(): AsyncGenerator<[string, FakeFileHandle | FakeDirectoryHandle]> {
    for (const pair of [...this.children.entries()]) yield pair;
  }
}

/** Fake OPFS root (`await navigator.storage.getDirectory()`). */
export function createFakeOpfsRoot(): FileSystemDirectoryHandle {
  return new FakeDirectoryHandle("") as unknown as FileSystemDirectoryHandle;
}

/** Write a file into a fake OPFS tree, creating directories on the way. */
export async function writeOpfsFile(
  root: FileSystemDirectoryHandle,
  path: string,
  data: string | Uint8Array,
): Promise<void> {
  const parts = path.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error("writeOpfsFile needs a file path");
  let dir = root as unknown as FakeDirectoryHandle;
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true });
  const writable = await (await dir.getFileHandle(fileName, { create: true })).createWritable();
  await writable.write(data);
  await writable.close();
}

// ------------------------------------------------------------- StorageManager

export interface FakeStorageManagerOptions {
  usage?: number;
  quota?: number;
  persisted?: boolean;
  /** What `persist()` answers when it is not persisted yet. Default false. */
  grant?: boolean;
  /** OPFS root served by `getDirectory()`. A fresh one is created when omitted. */
  root?: FileSystemDirectoryHandle;
}

export interface FakeStorageManager extends StorageManager {
  readonly root: FileSystemDirectoryHandle;
  readonly persistCalls: number;
}

/** Fake `navigator.storage`. Omit `quota`/`usage` to model a browser without an estimate. */
export function createFakeStorageManager(opts: FakeStorageManagerOptions = {}): FakeStorageManager {
  let persisted = opts.persisted ?? false;
  let calls = 0;
  const root = opts.root ?? createFakeOpfsRoot();
  const fake = {
    root,
    get persistCalls() {
      return calls;
    },
    async estimate() {
      const e: StorageEstimate = {};
      if (opts.usage !== undefined) e.usage = opts.usage;
      if (opts.quota !== undefined) e.quota = opts.quota;
      return e;
    },
    async persisted() {
      return persisted;
    },
    async persist() {
      calls += 1;
      if (opts.grant) persisted = true;
      return persisted;
    },
    async getDirectory() {
      return root;
    },
  };
  return fake as unknown as FakeStorageManager;
}

// ------------------------------------------------------------------ IndexedDB

/** Put one `{ url, data }` record into a database (created with a `urls` store when missing). */
export async function putIndexedDbRecord(
  factory: IDBFactory,
  dbName: string,
  record: { url: string; data: unknown },
  storeName = "urls",
): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = factory.open(dbName);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName, { keyPath: "url" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Convenience bundle: fake caches and a fake storage manager (with OPFS). Pass your own IndexedDB factory. */
export function createFakeEnv(
  opts: FakeStorageManagerOptions & { indexedDB?: IDBFactory } = {},
): StorageEnv & { caches: CacheStorage; storage: FakeStorageManager } {
  return {
    caches: createFakeCacheStorage(),
    storage: createFakeStorageManager(opts),
    indexedDB: opts.indexedDB,
  };
}

// ------------------------------------------------------------ recorded layouts

/** Shape of `examples/fixtures/layouts.json`: key layouts recorded from real libraries. */
export interface RecordedLayout {
  cacheApi?: { cacheName: string; entries: { url: string; bytes: number }[] };
  indexedDb?: {
    database: string;
    buffers?: { url: string; bytes: number }[];
    json?: { url: string; value: unknown }[];
  };
  opfs?: { directory: string; files: { stem: string; url: string; nbytes: number; binBytes: number }[] };
}

/**
 * Fill fake storages with a recorded layout. Bodies are zero-filled buffers of the
 * recorded size; no real model weights are involved.
 */
export async function seedRecordedLayout(
  env: StorageEnv,
  layout: RecordedLayout,
  select: { cacheApi?: boolean; indexedDb?: boolean; opfs?: boolean } = {},
): Promise<void> {
  if (layout.cacheApi && select.cacheApi !== false && env.caches) {
    const cache = await env.caches.open(layout.cacheApi.cacheName);
    for (const e of layout.cacheApi.entries) {
      await cache.put(e.url, new Response(new Uint8Array(e.bytes), { headers: { "content-length": String(e.bytes) } }));
    }
  }
  if (layout.indexedDb && select.indexedDb !== false && env.indexedDB) {
    const { database, buffers = [], json = [] } = layout.indexedDb;
    for (const b of buffers) await putIndexedDbRecord(env.indexedDB, database, { url: b.url, data: new ArrayBuffer(b.bytes) });
    for (const j of json) await putIndexedDbRecord(env.indexedDB, database, { url: j.url, data: j.value });
  }
  if (layout.opfs && select.opfs !== false && env.storage) {
    const root = await env.storage.getDirectory();
    for (const f of layout.opfs.files) {
      await writeOpfsFile(root, `${layout.opfs.directory}/${f.stem}.bin`, new Uint8Array(f.binBytes));
      await writeOpfsFile(root, `${layout.opfs.directory}/${f.stem}.record.json`, JSON.stringify({ url: f.url, nbytes: f.nbytes }));
    }
  }
}
