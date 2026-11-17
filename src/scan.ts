import { defaultAdapters } from "./adapters/index.js";
import { defaultEnv } from "./env.js";
import { DEFAULT_HOSTS, parseModelUrl } from "./parse-url.js";
import type { EstimateInfo, Entry, ModelGroup, ScanResult, SkippedStore, StorageAdapter, StorageEnv } from "./types.js";

export interface ScanOptions {
  adapters?: StorageAdapter[];
  env?: StorageEnv;
  /** Hosts whose `/resolve/` URLs are recognised as model files. */
  hosts?: string[];
  /** Read bodies of cache entries lacking content-length (can be slow and memory hungry). */
  measureUnknown?: boolean;
}

export const OTHER_GROUP = "(other)";

export async function collectEntries(
  adapters: StorageAdapter[],
  env: StorageEnv,
  measureUnknown: boolean,
): Promise<{ entries: Entry[]; skipped: SkippedStore[] }> {
  const entries: Entry[] = [];
  const skipped: SkippedStore[] = [];
  for (const adapter of adapters) {
    try {
      entries.push(...(await adapter.list(env, { measureUnknown })));
    } catch (e) {
      skipped.push({ store: adapter.name, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return { entries, skipped };
}

export function groupEntries(entries: Entry[], hosts: string[] = DEFAULT_HOSTS): ModelGroup[] {
  const map = new Map<string, { group: ModelGroup; revisions: string[]; variants: Set<string>; stores: Set<string> }>();
  for (const entry of entries) {
    const parsed = parseModelUrl(entry.url, hosts);
    const id = parsed?.id ?? OTHER_GROUP;
    let slot = map.get(id);
    if (!slot) {
      slot = {
        group: { id, revision: null, variants: [], stores: [], files: 0, bytes: 0, unknownSizeFiles: 0, partial: false, entries: [] },
        revisions: [],
        variants: new Set(),
        stores: new Set(),
      };
      map.set(id, slot);
    }
    const g = slot.group;
    g.files += 1;
    if (entry.bytes === null) g.unknownSizeFiles += 1;
    else g.bytes += entry.bytes;
    if (entry.partial) g.partial = true;
    if (parsed?.revision) slot.revisions.push(parsed.revision);
    if (parsed?.variant) slot.variants.add(parsed.variant);
    slot.stores.add(entry.store);
    g.entries.push(entry);
  }
  return [...map.values()]
    .map(({ group, revisions, variants, stores }) => ({
      ...group,
      revision: revisions[0] ?? null,
      variants: [...variants].sort(),
      stores: [...stores].sort(),
    }))
    .sort((a, b) => b.bytes - a.bytes || a.id.localeCompare(b.id));
}

export async function readStorageState(
  env: StorageEnv,
): Promise<{ estimate: EstimateInfo | null; persisted: boolean | null }> {
  let estimate: EstimateInfo | null = null;
  let persisted: boolean | null = null;
  try {
    if (env.storage && typeof env.storage.estimate === "function") {
      const e = await env.storage.estimate();
      if (typeof e.quota === "number" || typeof e.usage === "number") {
        estimate = { usage: e.usage, quota: e.quota, approximate: true };
      }
    }
  } catch {
    estimate = null;
  }
  try {
    if (env.storage && typeof env.storage.persisted === "function") persisted = await env.storage.persisted();
  } catch {
    persisted = null;
  }
  return { estimate, persisted };
}

/** List every model file this origin stored, grouped by model, with quota information. */
export async function scan(options: ScanOptions = {}): Promise<ScanResult> {
  const env = options.env ?? defaultEnv();
  const adapters = options.adapters ?? defaultAdapters();
  const { entries, skipped } = await collectEntries(adapters, env, options.measureUnknown ?? false);
  const { estimate, persisted } = await readStorageState(env);
  return { entries, models: groupEntries(entries, options.hosts), estimate, persisted, skipped };
}
