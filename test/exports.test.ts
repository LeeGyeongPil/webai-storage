import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  exports: Record<string, string | { types?: string; default?: string }>;
};

function jsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? jsFiles(p) : p.endsWith(".js") ? [p] : [];
  });
}

describe("package exports and build output (AC-7, AC-10)", () => {
  it("every export path exists in dist, with a d.ts", () => {
    for (const [key, target] of Object.entries(pkg.exports)) {
      if (typeof target === "string") continue;
      expect(existsSync(resolve(root, target.default ?? "")), key + " js").toBe(true);
      expect(existsSync(resolve(root, target.types ?? "")), key + " d.ts").toBe(true);
    }
    for (const entry of ["dist/index.js", "dist/react/index.js", "dist/testing/index.js"]) {
      expect(existsSync(resolve(root, entry)), entry).toBe(true);
    }
  });

  it("the core build does not import react", () => {
    const core = jsFiles(resolve(root, "dist")).filter((f) => !f.includes("/dist/react/"));
    expect(core.length).toBeGreaterThan(5);
    for (const file of core) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/from\s+["']react/);
    }
    const entry = readFileSync(resolve(root, "dist/index.js"), "utf8");
    expect(entry).not.toContain("react");
  });

  it("the core entry loads in plain Node and exposes the public API", async () => {
    const mod = (await import(resolve(root, "dist/index.js"))) as Record<string, unknown>;
    for (const name of ["scan", "removeModel", "clearAll", "preflight", "fetchHfFileSizes", "requestPersist", "formatBytes", "parseModelUrl"]) {
      expect(typeof mod[name], name).toBe("function");
    }
    const testing = (await import(resolve(root, "dist/testing/index.js"))) as Record<string, unknown>;
    expect(typeof testing.createFakeCacheStorage).toBe("function");
  });

  it("the react entry exposes the panel and hook", async () => {
    const mod = (await import(resolve(root, "dist/react/index.js"))) as Record<string, unknown>;
    expect(typeof mod.ModelStoragePanel).toBe("function");
    expect(typeof mod.useModelStorage).toBe("function");
  });

  it("public sources do not make unverified claims about history clearing", () => {
    const files = [...jsFiles(resolve(root, "dist"))];
    for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/browsing (data|history)/i);
  });
});
