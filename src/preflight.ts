import { defaultEnv } from "./env.js";
import { InvalidInputError } from "./errors.js";
import { fetchHfFileSizes } from "./hf-sizes.js";
import { parseModelUrl } from "./parse-url.js";
import { readStorageState } from "./scan.js";
import type { Preflight, ScanResult, StorageEnv } from "./types.js";

export type PreflightInput =
  | { needBytes: number }
  | { model?: string; files: { name?: string; size: number }[] }
  | { hf: { model: string; files: string[]; revision?: string; host?: string; fetch?: typeof fetch } };

export interface PreflightOptions {
  /** Safety margin on top of the need. Default 0.2 (20 %). */
  margin?: number;
  /** A previous scan: its entries are subtracted from the need and its estimate is reused. */
  scan?: ScanResult;
  env?: StorageEnv;
  /** Recommend persist() when the (remaining) need reaches this many bytes. Default 100,000,000. */
  recommendPersistAboveBytes?: number;
}

function checkSize(n: unknown, what: string): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) {
    throw new InvalidInputError(`${what} must be a non-negative finite number of bytes, got ${String(n)}.`);
  }
  return n;
}

/** Decide whether a download of the given size fits into the remaining quota. */
export async function preflight(input: PreflightInput, opts: PreflightOptions = {}): Promise<Preflight> {
  if (typeof input !== "object" || input === null || !("needBytes" in input || "files" in input || "hf" in input)) {
    throw new InvalidInputError("input must be { needBytes } | { files } | { hf }.");
  }
  const margin = opts.margin ?? 0.2;
  if (typeof margin !== "number" || !Number.isFinite(margin) || margin < 0) {
    throw new InvalidInputError(`margin must be a non-negative number, got ${String(margin)}.`);
  }
  const env = opts.env ?? defaultEnv();
  const cachedBytes = (match: (url: string) => boolean): number => {
    let sum = 0;
    for (const e of opts.scan?.entries ?? []) {
      if (!e.partial && e.bytes !== null && match(e.url)) sum += e.bytes;
    }
    return sum;
  };

  let needBytes: number;
  let alreadyCached = 0;
  if ("needBytes" in input) {
    needBytes = checkSize(input.needBytes, "needBytes");
  } else if ("files" in input) {
    needBytes = 0;
    if (!Array.isArray(input.files)) throw new InvalidInputError("files must be an array of { name?, size }.");
    const model = input.model;
    for (const f of input.files) {
      const size = checkSize(f.size, f.name ? `size of "${f.name}"` : "file size");
      needBytes += size;
      // Only subtract cached bytes when the caller names the model: file names such as
      // "onnx/model_quantized.onnx" are shared by many models.
      if (f.name && model) {
        alreadyCached += Math.min(
          size,
          cachedBytes((u) => {
            const p = parseModelUrl(u);
            return p !== null && p.id === model && p.file === f.name;
          }),
        );
      }
    }
  } else {
    const { model } = input.hf;
    if (!model || model.trim() === "") throw new InvalidInputError("hf.model must be a non-empty model id.");
    const sizes = await fetchHfFileSizes(input.hf);
    needBytes = sizes.total;
    for (const f of sizes.files) {
      alreadyCached += Math.min(
        f.size,
        cachedBytes((u) => {
          const p = parseModelUrl(u);
          return p !== null && p.id === model && p.file === f.name;
        }),
      );
    }
  }

  const remaining = Math.max(0, needBytes - alreadyCached);
  const state = opts.scan ? { estimate: opts.scan.estimate, persisted: opts.scan.persisted } : await readStorageState(env);
  const quota = state.estimate?.quota ?? null;
  const usage = state.estimate?.usage ?? null;
  const free = quota !== null && usage !== null ? Math.max(0, quota - usage) : null;

  let verdict: Preflight["verdict"] = "unknown";
  if (free !== null) {
    verdict = free >= remaining * (1 + margin) ? "fits" : free >= remaining ? "tight" : "insufficient";
  }

  const threshold = opts.recommendPersistAboveBytes ?? 100_000_000;
  const canPersist = typeof env.storage?.persist === "function";
  let persistAdvice: Preflight["persistAdvice"] = "none";
  if (state.persisted === true) persistAdvice = "already";
  else if (canPersist && remaining >= threshold) persistAdvice = "recommend";

  return {
    verdict,
    needBytes,
    alreadyCachedBytes: alreadyCached,
    freeBytes: free,
    quotaBytes: quota,
    usageBytes: usage,
    margin,
    persisted: state.persisted,
    persistAdvice,
    approximate: true,
  };
}
