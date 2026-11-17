import { describe, expect, it } from "vitest";
import { HfLookupError, InvalidInputError, fetchHfFileSizes } from "../src/index.js";

function recorder(handler: (url: string) => Response) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    return handler(url);
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("fetchHfFileSizes (AC-5)", () => {
  it("sends Range: bytes=0-0 and parses Content-Range", async () => {
    const sizes: Record<string, number> = { "config.json": 650, "onnx/model_quantized.onnx": 22972370 };
    const { fn, calls } = recorder((url) => {
      const file = url.split("/resolve/main/")[1]!;
      return new Response("x", { status: 206, headers: { "content-range": `bytes 0-0/${sizes[file]}` } });
    });
    const result = await fetchHfFileSizes({
      model: "Xenova/all-MiniLM-L6-v2",
      files: ["config.json", "onnx/model_quantized.onnx"],
      fetch: fn,
    });
    expect(result.files).toEqual([
      { name: "config.json", size: 650 },
      { name: "onnx/model_quantized.onnx", size: 22972370 },
    ]);
    expect(result.total).toBe(22973020);
    expect(calls.map((c) => c.url)).toEqual([
      "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/config.json",
      "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx",
    ]);
    expect(calls.every((c) => c.headers.Range === "bytes=0-0")).toBe(true);
  });

  it("uses a custom revision and host", async () => {
    const { fn, calls } = recorder(() => new Response(null, { status: 206, headers: { "content-range": "bytes 0-0/22972370" } }));
    await fetchHfFileSizes({ model: "a/b", files: ["f.bin"], revision: "v1", host: "hf-mirror.com", fetch: fn });
    expect(calls[0]?.url).toBe("https://hf-mirror.com/a/b/resolve/v1/f.bin");
  });

  it("falls back to content-length when the server answers 200", async () => {
    const { fn } = recorder(() => new Response("abc", { status: 200, headers: { "content-length": "3" } }));
    expect((await fetchHfFileSizes({ model: "a/b", files: ["f"], fetch: fn })).total).toBe(3);
  });

  it("throws HfLookupError naming the file on 404", async () => {
    const { fn } = recorder(() => new Response("nope", { status: 404 }));
    const err = await fetchHfFileSizes({ model: "a/b", files: ["missing.onnx"], fetch: fn }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HfLookupError);
    expect((err as HfLookupError).file).toBe("missing.onnx");
    expect((err as HfLookupError).status).toBe(404);
    expect((err as Error).message).toContain("missing.onnx");
  });

  it("wraps network failures and rejects bad input", async () => {
    const failing = (async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    await expect(fetchHfFileSizes({ model: "a/b", files: ["f"], fetch: failing })).rejects.toThrow(/offline/);
    await expect(fetchHfFileSizes({ model: "", files: ["f"], fetch: failing })).rejects.toBeInstanceOf(InvalidInputError);
    await expect(fetchHfFileSizes({ model: "a/b", files: [], fetch: failing })).rejects.toBeInstanceOf(InvalidInputError);
  });

  it("errors when no size header exists", async () => {
    const { fn } = recorder(() => new Response(null, { status: 206 }));
    await expect(fetchHfFileSizes({ model: "a/b", files: ["f"], fetch: fn })).rejects.toBeInstanceOf(HfLookupError);
  });
});
