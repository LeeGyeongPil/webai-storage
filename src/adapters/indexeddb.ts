import { WebAiStorageError } from "../errors.js";
import type { Entry, StorageAdapter, StorageEnv } from "../types.js";

export interface IndexedDbAdapterOptions {
  /** Database names to inspect. Default: the three WebLLM scopes. */
  databases?: string[];
  /** Object store holding `{ url, data }` records. Default: "urls". */
  storeName?: string;
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function openDb(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error(`Could not open IndexedDB database "${name}"`));
    req.onblocked = () => reject(new Error(`IndexedDB database "${name}" is blocked`));
  });
}

function sizeOf(data: unknown): { bytes: number; source: Entry["sizeSource"] } {
  const tag = Object.prototype.toString.call(data);
  if (tag === "[object ArrayBuffer]" || ArrayBuffer.isView(data)) {
    return { bytes: (data as ArrayBuffer).byteLength, source: "byteLength" };
  }
  if (tag === "[object Blob]" || tag === "[object File]") {
    return { bytes: (data as Blob).size, source: "byteLength" };
  }
  const json = JSON.stringify(data) ?? "";
  return { bytes: new TextEncoder().encode(json).length, source: "json-estimate" };
}

/** IndexedDB adapter for the WebLLM layout (`webllm/model` database, `urls` store). */
export function indexedDbAdapter(options: IndexedDbAdapterOptions = {}): StorageAdapter {
  const dbNames = options.databases ?? ["webllm/model", "webllm/config", "webllm/wasm"];
  const storeName = options.storeName ?? "urls";

  return {
    name: "indexeddb",
    async list(env: StorageEnv): Promise<Entry[]> {
      const factory = env.indexedDB;
      if (!factory) throw new WebAiStorageError("IndexedDB is not available in this context.");
      if (typeof factory.databases !== "function") {
        throw new WebAiStorageError("indexedDB.databases() is not available in this browser.");
      }
      const present = new Set((await factory.databases()).map((d) => d.name));
      const out: Entry[] = [];
      for (const dbName of dbNames.filter((n) => present.has(n))) {
        const db = await openDb(factory, dbName);
        try {
          if (!db.objectStoreNames.contains(storeName)) continue;
          const records = await promisify(db.transaction(storeName, "readonly").objectStore(storeName).getAll());
          for (const rec of records as { url?: unknown; data?: unknown }[]) {
            if (typeof rec?.url !== "string") continue;
            const { bytes, source } = sizeOf(rec.data);
            out.push({ url: rec.url, store: "indexeddb", container: dbName, bytes, sizeSource: source, partial: false });
          }
        } finally {
          db.close();
        }
      }
      return out;
    },
    async remove(env, entry) {
      const factory = env.indexedDB;
      if (!factory) throw new WebAiStorageError("IndexedDB is not available in this context.");
      const db = await openDb(factory, entry.container);
      try {
        const tx = db.transaction(storeName, "readwrite");
        const done = new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
          tx.onabort = () => reject(tx.error ?? new Error("IndexedDB delete aborted"));
        });
        tx.objectStore(storeName).delete(entry.url);
        await done;
      } finally {
        db.close();
      }
    },
  };
}
