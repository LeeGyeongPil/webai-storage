import { WebAiStorageError } from "../errors.js";
import type { Entry, StorageAdapter, StorageEnv } from "../types.js";

export interface OpfsAdapterOptions {
  /** Root directory used by WebLLM. Default: "tvmjs-opfs-store". */
  root?: string;
}

const RECORD_SUFFIX = ".record.json";
const BIN_SUFFIX = ".bin";

function isNotFound(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { name?: string }).name === "NotFoundError";
}

async function getRoot(env: StorageEnv): Promise<FileSystemDirectoryHandle> {
  if (!env.storage || typeof env.storage.getDirectory !== "function") {
    throw new WebAiStorageError("OPFS (navigator.storage.getDirectory) is not available in this context.");
  }
  return env.storage.getDirectory();
}

async function descend(root: FileSystemDirectoryHandle, path: string): Promise<FileSystemDirectoryHandle | null> {
  let dir = root;
  for (const part of path.split("/").filter(Boolean)) {
    try {
      dir = await dir.getDirectoryHandle(part);
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }
  return dir;
}

async function walk(dir: FileSystemDirectoryHandle, path: string, out: Entry[]): Promise<void> {
  const files = new Map<string, FileSystemFileHandle>();
  const subdirs: [string, FileSystemDirectoryHandle][] = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "directory") subdirs.push([name, handle as FileSystemDirectoryHandle]);
    else files.set(name, handle as FileSystemFileHandle);
  }
  const stems = new Set<string>();
  for (const name of files.keys()) {
    if (name.endsWith(RECORD_SUFFIX)) stems.add(name.slice(0, -RECORD_SUFFIX.length));
    else if (name.endsWith(BIN_SUFFIX)) stems.add(name.slice(0, -BIN_SUFFIX.length));
  }
  for (const stem of [...stems].sort()) {
    const bin = files.get(stem + BIN_SUFFIX);
    const record = files.get(stem + RECORD_SUFFIX);
    const binSize = bin ? (await bin.getFile()).size : 0;
    let url = `opfs:///${path}/${stem}${BIN_SUFFIX}`;
    let announced: number | null = null;
    if (record) {
      try {
        const parsed = JSON.parse(await (await record.getFile()).text()) as { url?: unknown; nbytes?: unknown };
        if (typeof parsed.url === "string") url = parsed.url;
        if (typeof parsed.nbytes === "number") announced = parsed.nbytes;
      } catch {
        // A corrupt record file leaves the entry under "(other)".
      }
    }
    out.push({
      url,
      store: "opfs",
      container: path,
      bytes: bin ? binSize : null,
      sizeSource: bin ? "opfs-file" : "unknown",
      partial: !bin || (announced !== null && binSize !== announced),
      key: stem,
    });
  }
  for (const [name, handle] of subdirs) await walk(handle, `${path}/${name}`, out);
}

/** OPFS adapter for the WebLLM layout (`tvmjs-opfs-store/**`: `<hash>.bin` + `<hash>.record.json`). */
export function opfsAdapter(options: OpfsAdapterOptions = {}): StorageAdapter {
  const rootName = options.root ?? "tvmjs-opfs-store";
  return {
    name: "opfs",
    async list(env: StorageEnv): Promise<Entry[]> {
      const root = await getRoot(env);
      const base = await descend(root, rootName);
      const out: Entry[] = [];
      if (base) await walk(base, rootName, out);
      return out;
    },
    async remove(env, entry) {
      const root = await getRoot(env);
      const dir = await descend(root, entry.container);
      if (!dir || !entry.key) return;
      for (const name of [entry.key + BIN_SUFFIX, entry.key + RECORD_SUFFIX]) {
        try {
          await dir.removeEntry(name);
        } catch (e) {
          if (!isNotFound(e)) throw e;
        }
      }
    },
  };
}
