import { WebAiStorageError } from "../errors.js";
import type { Entry, StorageAdapter, StorageEnv } from "../types.js";

export interface CacheApiAdapterOptions {
  /** Exact cache names to inspect. Default: ["transformers-cache"]. */
  names?: string[];
  /** Cache name prefixes to inspect. Default: ["webllm/"]. */
  prefixes?: string[];
}

/** Cache API adapter (Transformers.js `transformers-cache`, WebLLM `webllm/*`). */
export function cacheApiAdapter(options: CacheApiAdapterOptions = {}): StorageAdapter {
  const names = options.names ?? ["transformers-cache"];
  const prefixes = options.prefixes ?? ["webllm/"];
  const wanted = (n: string) => names.includes(n) || prefixes.some((p) => n.startsWith(p));

  return {
    name: "cache-api",
    async list(env: StorageEnv, opts): Promise<Entry[]> {
      const storage = env.caches;
      if (!storage) throw new WebAiStorageError("Cache API (caches) is not available in this context.");
      const out: Entry[] = [];
      for (const cacheName of (await storage.keys()).filter(wanted)) {
        const cache = await storage.open(cacheName);
        for (const request of await cache.keys()) {
          let bytes: number | null = null;
          let sizeSource: Entry["sizeSource"] = "unknown";
          const response = await cache.match(request);
          const header = response?.headers.get("content-length");
          if (header !== null && header !== undefined && /^\d+$/.test(header)) {
            bytes = Number(header);
            sizeSource = "content-length";
          } else if (response && opts.measureUnknown) {
            // Reading the body can pull a large file into memory, so it is opt-in.
            bytes = (await response.blob()).size;
            sizeSource = "blob";
          }
          out.push({ url: request.url, store: "cache-api", container: cacheName, bytes, sizeSource, partial: false });
        }
      }
      return out;
    },
    async remove(env, entry) {
      const storage = env.caches;
      if (!storage) throw new WebAiStorageError("Cache API (caches) is not available in this context.");
      const cache = await storage.open(entry.container);
      await cache.delete(entry.url);
    },
  };
}
