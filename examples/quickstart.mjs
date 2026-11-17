// Minimal use of webai-storage against in-memory fakes (runs in Node, no browser needed).
// In a real page, drop `env` and the fake setup: the library reads the browser globals.
import { scan, preflight, formatBytes } from "webai-storage";
import { createFakeEnv } from "webai-storage/testing";

const env = createFakeEnv({ quota: 100_000_000, usage: 30_000_000 });
const cache = await env.caches.open("transformers-cache");
const url = "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx";
await cache.put(url, new Response(new Uint8Array(23_000_000), { headers: { "content-length": "23000000" } }));

const { models } = await scan({ env });
for (const m of models) console.log(m.id, m.variants.join(","), formatBytes(m.bytes), m.stores.join(","));

const check = await preflight({ needBytes: 60_000_000 }, { env });
console.log(check.verdict, formatBytes(check.freeBytes), check.persistAdvice);
