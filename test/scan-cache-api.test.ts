import { describe, expect, it } from "vitest";
import { scan } from "../src/index.js";
import { MINILM, makeEnv } from "./helpers.js";

describe("Cache API scan (AC-1)", () => {
  it("groups the four recorded Transformers.js keys into one model", async () => {
    const env = await makeEnv({ cacheApi: true });
    const result = await scan({ env });
    expect(result.models).toHaveLength(1);
    const m = result.models[0]!;
    expect(m.id).toBe(MINILM);
    expect(m.revision).toBe("main");
    expect(m.variants).toEqual(["q8"]);
    expect(m.files).toBe(4);
    expect(m.bytes).toBe(23685047);
    expect(m.unknownSizeFiles).toBe(0);
    expect(m.partial).toBe(false);
    expect(m.stores).toEqual(["cache-api"]);
    expect(m.entries.every((e) => e.sizeSource === "content-length")).toBe(true);
  });

  it("ignores caches whose name does not match", async () => {
    const env = await makeEnv({ cacheApi: true });
    const other = await env.caches.open("my-app-cache");
    await other.put("https://huggingface.co/foo/bar/resolve/main/x.json", new Response("{}", { headers: { "content-length": "2" } }));
    const result = await scan({ env });
    expect(result.entries.some((e) => e.container === "my-app-cache")).toBe(false);
    expect(result.models.map((m) => m.id)).toEqual([MINILM]);
  });

  it("also reads webllm/ prefixed caches", async () => {
    const env = await makeEnv({});
    const c = await env.caches.open("webllm/model");
    await c.put(
      "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/params_shard_0.bin",
      new Response(new Uint8Array(10), { headers: { "content-length": "10" } }),
    );
    const result = await scan({ env });
    expect(result.models[0]?.variants).toEqual(["q4f16_1"]);
  });

  it("reports bytes null for entries without content-length unless measureUnknown", async () => {
    const env = await makeEnv({});
    const c = await env.caches.open("transformers-cache");
    await c.put("https://huggingface.co/a/b/resolve/main/model.onnx", new Response(new Uint8Array(500)));
    const plain = await scan({ env });
    expect(plain.models[0]?.unknownSizeFiles).toBe(1);
    expect(plain.models[0]?.bytes).toBe(0);
    expect(plain.entries[0]?.bytes).toBeNull();
    expect(plain.entries[0]?.sizeSource).toBe("unknown");

    const measured = await scan({ env, measureUnknown: true });
    expect(measured.entries[0]?.bytes).toBe(500);
    expect(measured.entries[0]?.sizeSource).toBe("blob");
    expect(measured.models[0]?.unknownSizeFiles).toBe(0);
  });

  it("detects fp32 and other dtype suffixes", async () => {
    const env = await makeEnv({});
    const c = await env.caches.open("transformers-cache");
    for (const f of ["onnx/model.onnx", "onnx/model_q4f16.onnx", "onnx/model_fp16.onnx"]) {
      await c.put(`https://huggingface.co/a/b/resolve/main/${f}`, new Response("x", { headers: { "content-length": "1" } }));
    }
    const result = await scan({ env });
    expect(result.models[0]?.variants).toEqual(["fp16", "fp32", "q4f16"]);
  });

  it("returns an empty model list and records skipped stores when nothing exists", async () => {
    const result = await scan({ env: {} });
    expect(result.models).toEqual([]);
    expect(result.estimate).toBeNull();
    expect(result.skipped.map((s) => s.store)).toEqual(["cache-api", "indexeddb", "opfs"]);
  });

  it("carries the quota estimate and persisted flag", async () => {
    const env = await makeEnv({ cacheApi: true });
    const result = await scan({ env });
    expect(result.estimate).toEqual({ usage: 25782199, quota: 62914560, approximate: true });
    expect(result.persisted).toBe(false);
  });
});
