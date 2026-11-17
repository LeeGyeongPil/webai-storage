import { defaultAdapters } from "./adapters/index.js";
import { defaultEnv } from "./env.js";
import { InvalidInputError } from "./errors.js";
import { collectEntries, groupEntries } from "./scan.js";
import type { ModelGroup, RemoveResult, StorageAdapter, StorageEnv } from "./types.js";

export interface RemoveOptions {
  adapters?: StorageAdapter[];
  env?: StorageEnv;
  hosts?: string[];
  /** Only delete entries held by this store (for example "cache-api"). */
  store?: string;
}

async function removeGroups(
  pick: (g: ModelGroup) => boolean,
  opts: RemoveOptions,
): Promise<RemoveResult> {
  const env = opts.env ?? defaultEnv();
  const adapters = opts.adapters ?? defaultAdapters();
  const { entries } = await collectEntries(adapters, env, false);
  const result: RemoveResult = { filesDeleted: 0, bytesFreed: 0 };
  for (const group of groupEntries(entries, opts.hosts).filter(pick)) {
    for (const entry of group.entries) {
      if (opts.store && entry.store !== opts.store) continue;
      const adapter = adapters.find((a) => a.name === entry.store);
      if (!adapter) continue;
      await adapter.remove(env, entry);
      result.filesDeleted += 1;
      result.bytesFreed += entry.bytes ?? 0;
    }
  }
  return result;
}

/** Delete every stored file of one model. Unknown ids delete nothing. */
export async function removeModel(id: string, opts: RemoveOptions = {}): Promise<RemoveResult> {
  if (typeof id !== "string" || id.trim() === "") {
    throw new InvalidInputError('removeModel needs a model id such as "Xenova/all-MiniLM-L6-v2".');
  }
  return removeGroups((g) => g.id === id, opts);
}

/** Delete all models, or only those for which `match` returns true. */
export async function clearAll(opts: RemoveOptions & { match?: (g: ModelGroup) => boolean } = {}): Promise<RemoveResult> {
  return removeGroups(opts.match ?? (() => true), opts);
}
