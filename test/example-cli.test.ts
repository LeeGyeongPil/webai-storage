import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const script = resolve(root, "examples/inventory.mjs");

function run(...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "" },
  });
}

describe("practice-mock example CLI (AC-9)", () => {
  it("has a built dist (run `npm run build` first)", () => {
    expect(existsSync(resolve(root, "dist/index.js"))).toBe(true);
  });

  it("prints the English inventory and a fits verdict", () => {
    const r = run("--lang", "en");
    expect(r.status).toBe(0);
    const out = r.stdout;
    expect(out.split("\n")[0]).toContain("Practice mock");
    expect(out).toContain("Xenova/all-MiniLM-L6-v2");
    expect(out).toContain("23.7 MB");
    expect(out).toContain("partial");
    expect(out).toContain("Verdict: fits");
    expect(out).toContain("Removed Xenova/all-MiniLM-L6-v2: 4 files, freed 23.7 MB");
  });

  it("prints Korean output with --lang ko", () => {
    const r = run("--lang", "ko");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("연습용 목");
    expect(r.stdout).toContain("판정: 받을 수 있음");
    expect(r.stdout).not.toContain("Verdict:");
  });

  it("--need 40000000 gives insufficient", () => {
    expect(run("--lang", "en", "--need", "40000000").stdout).toContain("Verdict: insufficient");
    expect(run("--lang", "ko", "--need", "40000000").stdout).toContain("판정: 공간 부족");
  });

  it("rejects a bad --need and unknown flags with a short message and exit 2 (Q-3)", () => {
    for (const bad of [["--need", "abc"], ["--need", "-5"], ["--bogus"]]) {
      const r = run("--lang", "en", ...bad);
      expect(r.status).toBe(2);
      expect(r.stdout).toBe("");
      expect(r.stderr).not.toContain("    at ");
      expect(r.stderr).toContain("Usage:");
    }
  });

  it("aligns the Korean table by display width (Q-3)", () => {
    const lines = run("--lang", "ko").stdout.split("\n");
    const header = lines.find((l) => l.startsWith("모델"))!;
    const data = lines.find((l) => l.startsWith("Xenova/all-MiniLM"))!;
    const wide = (s: string) => [...s].reduce((n, c) => n + (c.charCodeAt(0) >= 0x1100 ? 2 : 1), 0);
    // The second column starts at the same display column in header and data rows.
    const col2 = (l: string) => wide(l.slice(0, l.search(/\s{2}\S/) + 2));
    expect(col2(header)).toBe(col2(data));
  });

  it("follows WEBAI_STORAGE_LANG and LANG when no flag is given", () => {
    const base = { PATH: process.env.PATH ?? "" };
    const viaOwn = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8", env: { ...base, WEBAI_STORAGE_LANG: "ko" } });
    expect(viaOwn.stdout).toContain("연습용 목");
    const viaLang = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8", env: { ...base, LANG: "ko_KR.UTF-8" } });
    expect(viaLang.stdout).toContain("연습용 목");
    const flagWins = spawnSync(process.execPath, [script, "--lang", "en"], { cwd: root, encoding: "utf8", env: { ...base, WEBAI_STORAGE_LANG: "ko" } });
    expect(flagWins.stdout).toContain("Practice mock");
    const dflt = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8", env: base });
    expect(dflt.stdout).toContain("Practice mock");
  });

  it("rejects an unsupported language with a non-zero exit", () => {
    const r = run("--lang", "fr");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("--lang must be en or ko");
  });
});
