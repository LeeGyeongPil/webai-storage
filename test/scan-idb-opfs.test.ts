import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { scan } from "../src/index.js";
import { createFakeEnv, putIndexedDbRecord, writeOpfsFile } from "../src/testing/index.js";
import { SMOL, makeEnv } from "./helpers.js";

describe("IndexedDB and OPFS scan (AC-2)", () => {
  it("reads the WebLLM IndexedDB layout with ArrayBuffer and JSON values", async () => {
    const env = await makeEnv({ indexedDb: true });
    const result = await scan({ env });
    const m = result.models[0]!;
    expect(m.id).toBe(SMOL);
    expect(m.variants).toEqual(["q4f16_1"]);
    expect(m.stores).toEqual(["indexeddb"]);
    const buf = m.entries.find((e) => e.sizeSource === "byteLength")!;
    expect(buf.bytes).toBe(2097152);
    const json = m.entries.find((e) => e.sizeSource === "json-estimate")!;
    expect(json.bytes).toBe(new TextEncoder().encode(JSON.stringify({ model_type: "llama", quantization: "q4f16_1", context_window_size: 4096 })).length);
    expect(m.bytes).toBe(2097152 + json.bytes!);
  });

  it("reads OPFS .bin + .record.json pairs and flags short files as partial", async () => {
    const env = await makeEnv({ opfs: true });
    const result = await scan({ env });
    const m = result.models[0]!;
    expect(m.id).toBe(SMOL);
    expect(m.variants).toEqual(["q4f16_1"]);
    expect(m.partial).toBe(true);
    expect(m.bytes).toBe(1000);
    expect(m.entries[0]).toMatchObject({ store: "opfs", sizeSource: "opfs-file", partial: true });
  });

  it("does not flag a complete OPFS file as partial", async () => {
    const env = await makeEnv({});
    const dir = "tvmjs-opfs-store/webllm/model";
    await writeOpfsFile(await env.storage.getDirectory(), `${dir}/aa.bin`, new Uint8Array(40));
    await writeOpfsFile(
      await env.storage.getDirectory(),
      `${dir}/aa.record.json`,
      JSON.stringify({ url: "https://huggingface.co/mlc-ai/X-q4f16_1-MLC/resolve/main/p.bin", nbytes: 40 }),
    );
    const result = await scan({ env });
    expect(result.models[0]?.partial).toBe(false);
  });

  it("puts non-Hugging-Face URLs into the (other) group", async () => {
    const env = await makeEnv({});
    await putIndexedDbRecord(env.indexedDB!, "webllm/wasm", {
      url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/lib.wasm",
      data: new ArrayBuffer(300),
    });
    const result = await scan({ env });
    expect(result.models.map((m) => m.id)).toEqual(["(other)"]);
    expect(result.models[0]?.bytes).toBe(300);
    expect(result.models[0]?.revision).toBeNull();
  });

  it("records a missing indexedDB.databases and a failing getDirectory in skipped without throwing", async () => {
    const real = new IDBFactory();
    const noDatabases = { open: real.open.bind(real) } as unknown as IDBFactory;
    const env = createFakeEnv({ indexedDB: noDatabases });
    (env.storage as unknown as { getDirectory: () => Promise<never> }).getDirectory = async () => {
      throw new Error("SecurityError: storage is disabled");
    };
    const result = await scan({ env });
    expect(result.skipped).toEqual([
      { store: "indexeddb", reason: "indexedDB.databases() is not available in this browser." },
      { store: "opfs", reason: "SecurityError: storage is disabled" },
    ]);
  });

  it("treats a missing OPFS root directory as empty, not skipped", async () => {
    const env = await makeEnv({});
    const result = await scan({ env });
    expect(result.skipped.map((s) => s.store)).toEqual([]);
    expect(result.entries).toEqual([]);
  });
});
