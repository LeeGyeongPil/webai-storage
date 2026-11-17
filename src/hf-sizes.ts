import { HfLookupError, InvalidInputError } from "./errors.js";

export interface HfSizeOptions {
  model: string;
  files: string[];
  revision?: string;
  host?: string;
  fetch?: typeof fetch;
}

export interface HfSizes {
  files: { name: string; size: number }[];
  total: number;
}

/** Ask Hugging Face for each file size with `Range: bytes=0-0` (no file body is downloaded). */
export async function fetchHfFileSizes(opts: HfSizeOptions): Promise<HfSizes> {
  if (!opts.model || opts.model.trim() === "") {
    throw new InvalidInputError('fetchHfFileSizes needs a model id such as "Xenova/all-MiniLM-L6-v2".');
  }
  if (!Array.isArray(opts.files) || opts.files.length === 0) {
    throw new InvalidInputError("fetchHfFileSizes needs at least one file name.");
  }
  const doFetch = opts.fetch ?? globalThis.fetch;
  const host = opts.host ?? "huggingface.co";
  const revision = opts.revision ?? "main";
  const files: HfSizes["files"] = [];
  for (const name of opts.files) {
    const path = name.split("/").map(encodeURIComponent).join("/");
    const url = `https://${host}/${opts.model}/resolve/${encodeURIComponent(revision)}/${path}`;
    let res: Response;
    try {
      res = await doFetch(url, { headers: { Range: "bytes=0-0" } });
    } catch (e) {
      throw new HfLookupError(name, null, e instanceof Error ? e.message : String(e));
    }
    try {
      await res.body?.cancel();
    } catch {
      // Closing the body early is best effort.
    }
    if (!res.ok) throw new HfLookupError(name, res.status, `request to ${url} failed`);
    files.push({ name, size: sizeFromResponse(res, name) });
  }
  return { files, total: files.reduce((sum, f) => sum + f.size, 0) };
}

function sizeFromResponse(res: Response, name: string): number {
  const range = res.headers.get("content-range");
  const m = range ? /\/(\d+)\s*$/.exec(range) : null;
  if (m?.[1]) return Number(m[1]);
  // A server that ignores Range answers 200 with the whole file; its length is the size.
  const length = res.headers.get("content-length");
  if (res.status === 200 && length && /^\d+$/.test(length)) return Number(length);
  throw new HfLookupError(name, res.status, "response has no usable Content-Range header");
}
