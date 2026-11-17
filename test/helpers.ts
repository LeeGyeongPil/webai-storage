import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { IDBFactory } from "fake-indexeddb";
import { createFakeEnv, seedRecordedLayout, type RecordedLayout } from "../src/testing/index.js";

// Tests run from the package root (npm test); happy-dom replaces global URL, so use a path.
export const layout = JSON.parse(
  readFileSync(resolve(process.cwd(), "examples/fixtures/layouts.json"), "utf8"),
) as RecordedLayout & { estimate: { quota: number; usage: number } };

export const MINILM = "Xenova/all-MiniLM-L6-v2";
export const SMOL = "mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC";

/** Fresh fake environment, optionally seeded with a part of the recorded layout. */
export async function makeEnv(
  seed: { cacheApi?: boolean; indexedDb?: boolean; opfs?: boolean } = { cacheApi: true, indexedDb: true, opfs: true },
  storage: { usage?: number; quota?: number; persisted?: boolean; grant?: boolean } = layout.estimate,
) {
  const env = createFakeEnv({ ...storage, indexedDB: new IDBFactory() });
  await seedRecordedLayout(env, layout, {
    cacheApi: seed.cacheApi ?? false,
    indexedDb: seed.indexedDb ?? false,
    opfs: seed.opfs ?? false,
  });
  return env;
}
