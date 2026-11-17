import { describe, expect, it } from "vitest";
import { InvalidInputError, preflight, scan } from "../src/index.js";
import { createFakeEnv } from "../src/testing/index.js";
import { MINILM, SMOL, layout, makeEnv } from "./helpers.js";

const storage = { quota: 62914560, usage: 25782199 };

describe("preflight (AC-4)", () => {
  it("returns fits / tight / insufficient from free space and the margin", async () => {
    const env = createFakeEnv(storage);
    const fits = await preflight({ needBytes: 23685047 }, { env });
    expect(fits.verdict).toBe("fits");
    expect(fits.freeBytes).toBe(37132361);
    expect(fits.margin).toBe(0.2);
    expect(fits.approximate).toBe(true);
    expect((await preflight({ needBytes: 33000000 }, { env })).verdict).toBe("tight");
    expect((await preflight({ needBytes: 40000000 }, { env })).verdict).toBe("insufficient");
  });

  it("returns unknown without an estimate", async () => {
    const result = await preflight({ needBytes: 10 }, { env: createFakeEnv({}) });
    expect(result.verdict).toBe("unknown");
    expect(result.freeBytes).toBeNull();
    expect((await preflight({ needBytes: 10 }, { env: {} })).verdict).toBe("unknown");
  });

  it("honours a custom margin", async () => {
    const env = createFakeEnv(storage);
    expect((await preflight({ needBytes: 33000000 }, { env, margin: 0.1 })).verdict).toBe("fits");
  });

  it("subtracts already cached bytes when a scan is given", async () => {
    const env = await makeEnv();
    const scanned = await scan({ env });
    const files = [
      { name: "onnx/model_quantized.onnx", size: 22972370 },
      { name: "extra.bin", size: 1000 },
    ];
    const result = await preflight({ model: MINILM, files }, { scan: scanned, env });
    expect(result.needBytes).toBe(22973370);
    expect(result.alreadyCachedBytes).toBe(22972370);
    expect(result.verdict).toBe("fits");
  });

  it("subtracts cached bytes for hf input using an injected fetch", async () => {
    const env = await makeEnv();
    const scanned = await scan({ env });
    const sizes: Record<string, number> = { "config.json": 650, "new.bin": 5000 };
    const fakeFetch = (async (url: string) => {
      const file = url.split("/resolve/main/")[1]!;
      return new Response(null, { status: 206, headers: { "content-range": `bytes 0-0/${sizes[file]}` } });
    }) as unknown as typeof fetch;
    const result = await preflight({ hf: { model: MINILM, files: ["config.json", "new.bin"], fetch: fakeFetch } }, { scan: scanned });
    expect(result.needBytes).toBe(5650);
    expect(result.alreadyCachedBytes).toBe(650);
  });

  it("does not subtract another model's bytes that share a file name (Q-1)", async () => {
    const env = await makeEnv();
    const scanned = await scan({ env });
    const files = [{ name: "onnx/model_quantized.onnx", size: 22972370 }];
    expect((await preflight({ files }, { scan: scanned, env })).alreadyCachedBytes).toBe(0);
    const other = await preflight({ model: "Xenova/bert-base-uncased", files }, { scan: scanned, env });
    expect(other.alreadyCachedBytes).toBe(0);
    const same = await preflight({ model: MINILM, files }, { scan: scanned, env });
    expect(same.alreadyCachedBytes).toBe(22972370);
  });

  it("throws InvalidInputError for a missing or malformed input (Q-4)", async () => {
    const env = createFakeEnv(storage);
    await expect(preflight({} as never, { env })).rejects.toBeInstanceOf(InvalidInputError);
    await expect(preflight(undefined as never, { env })).rejects.toBeInstanceOf(InvalidInputError);
    await expect(preflight({ files: 3 } as never, { env })).rejects.toBeInstanceOf(InvalidInputError);
  });

  it("does not count partial entries as cached", async () => {
    const env = await makeEnv({ opfs: true });
    const scanned = await scan({ env });
    const url = layout.opfs!.files[0]!.url;
    const name = url.split("/resolve/main/")[1]!;
    const result = await preflight({ model: SMOL, files: [{ name, size: 4000 }] }, { scan: scanned });
    expect(result.alreadyCachedBytes).toBe(0);
  });

  it("rejects negative, NaN and infinite sizes", async () => {
    const env = createFakeEnv(storage);
    await expect(preflight({ needBytes: -1 }, { env })).rejects.toBeInstanceOf(InvalidInputError);
    await expect(preflight({ needBytes: Number.NaN }, { env })).rejects.toBeInstanceOf(InvalidInputError);
    await expect(preflight({ files: [{ size: Infinity }] }, { env })).rejects.toBeInstanceOf(InvalidInputError);
    await expect(preflight({ files: [{ name: "a", size: -5 }] }, { env })).rejects.toThrow(/"a"/);
    await expect(preflight({ needBytes: 1 }, { env, margin: -0.5 })).rejects.toBeInstanceOf(InvalidInputError);
    await expect(preflight({ hf: { model: "", files: ["a"] } }, { env })).rejects.toBeInstanceOf(InvalidInputError);
  });

  it("gives persist advice", async () => {
    const big = { needBytes: 100_000_000 };
    const roomy = { quota: 1_000_000_000, usage: 0 };
    expect((await preflight(big, { env: createFakeEnv({ ...roomy, persisted: true }) })).persistAdvice).toBe("already");
    expect((await preflight(big, { env: createFakeEnv({ ...roomy, persisted: false }) })).persistAdvice).toBe("recommend");
    expect((await preflight({ needBytes: 99_999_999 }, { env: createFakeEnv({ ...roomy, persisted: false }) })).persistAdvice).toBe("none");
    expect(
      (await preflight(big, { env: createFakeEnv({ ...roomy }), recommendPersistAboveBytes: 200_000_000 })).persistAdvice,
    ).toBe("none");
  });
});
