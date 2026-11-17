import { describe, expect, it } from "vitest";
import { clearAll, removeModel, scan, InvalidInputError } from "../src/index.js";
import { MINILM, SMOL, makeEnv } from "./helpers.js";

describe("remove (AC-3)", () => {
  it("removes one model and leaves the others", async () => {
    const env = await makeEnv();
    const result = await removeModel(MINILM, { env });
    expect(result).toEqual({ filesDeleted: 4, bytesFreed: 23685047 });
    const after = await scan({ env });
    expect(after.models.map((m) => m.id)).toEqual([SMOL]);
    expect(after.entries.some((e) => e.store === "cache-api")).toBe(false);
  });

  it("deletes both the .bin and the .record.json from OPFS, plus IndexedDB records", async () => {
    const env = await makeEnv();
    const result = await removeModel(SMOL, { env });
    expect(result.filesDeleted).toBe(3);
    const root = await env.storage.getDirectory();
    const dir = await (await (await root.getDirectoryHandle("tvmjs-opfs-store")).getDirectoryHandle("webllm")).getDirectoryHandle("model");
    const names: string[] = [];
    for await (const [name] of dir.entries()) names.push(name);
    expect(names).toEqual([]);
    expect((await scan({ env })).models.map((m) => m.id)).toEqual([MINILM]);
  });

  it("limits deletion to one store with the store option", async () => {
    const env = await makeEnv();
    const result = await removeModel(SMOL, { env, store: "opfs" });
    expect(result.filesDeleted).toBe(1);
    const after = await scan({ env });
    expect(after.models.find((m) => m.id === SMOL)?.stores).toEqual(["indexeddb"]);
  });

  it("clearAll with match deletes only matching models", async () => {
    const env = await makeEnv();
    const result = await clearAll({ env, match: (g) => g.partial });
    expect(result.filesDeleted).toBe(3);
    expect((await scan({ env })).models.map((m) => m.id)).toEqual([MINILM]);
  });

  it("clearAll without match deletes everything", async () => {
    const env = await makeEnv();
    await clearAll({ env });
    expect((await scan({ env })).models).toEqual([]);
  });

  it("an unknown id deletes nothing and an empty id is rejected", async () => {
    const env = await makeEnv();
    expect(await removeModel("nobody/nothing", { env })).toEqual({ filesDeleted: 0, bytesFreed: 0 });
    await expect(removeModel("  ", { env })).rejects.toBeInstanceOf(InvalidInputError);
    expect((await scan({ env })).models).toHaveLength(2);
  });
});
