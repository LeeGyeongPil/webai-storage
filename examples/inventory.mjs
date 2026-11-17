#!/usr/bin/env node
// Practice mock: runs the real scan / preflight / removeModel code paths against
// in-memory fake storage that is seeded with layouts recorded from real libraries.
//
//   npm run example -- --lang ko
//   npm run example -- --need 40000000
import { readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import { formatBytes, preflight, removeModel, resolveLang, scan, t } from "../dist/index.js";
import { createFakeEnv, seedRecordedLayout } from "../dist/testing/index.js";

// --- 1. 인자 해석: --lang > WEBAI_STORAGE_LANG > LC_ALL/LC_MESSAGES/LANG > en
const args = process.argv.slice(2);
function option(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: npm run example -- [--lang en|ko] [--need <bytes>]");
  process.exit(0);
}
let lang;
try {
  lang = resolveLang(option("--lang"), process.env);
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
const usage = "Usage: npm run example -- [--lang en|ko] [--need <bytes>]";
const known = new Set(["--lang", "--need", "--help", "-h"]);
const unknown = args.filter((a, i) => a.startsWith("-") && !known.has(a) && !(args[i - 1] === "--need"));
if (unknown.length > 0) {
  console.error(`Unknown option: ${unknown.join(" ")}\n${usage}`);
  process.exit(2);
}
const needArg = option("--need");
const need = needArg === undefined ? 23685047 : Number(needArg);
if (needArg !== undefined && (needArg.trim() === "" || !Number.isFinite(need) || need < 0)) {
  console.error(`--need must be a non-negative number of bytes\n${usage}`);
  process.exit(2);
}

// --- 2. 기록해 둔 실제 레이아웃으로 가짜 저장소를 채운다 (본문은 0 으로 채운 버퍼)
const layout = JSON.parse(readFileSync(new URL("./fixtures/layouts.json", import.meta.url), "utf8"));
const env = createFakeEnv({ ...layout.estimate, indexedDB: new IDBFactory() });
await seedRecordedLayout(env, layout);

// --- 3. 실제 scan() 으로 열거·묶기
console.log(t(lang, "mockBanner"));
console.log("");
const result = await scan({ env });
const rows = result.models.map((m) => [
  m.id,
  m.stores.join(","),
  m.variants.join(",") || "-",
  String(m.files),
  formatBytes(m.bytes, lang) + (m.partial ? "  " + t(lang, "partial") : ""),
]);
const header = [t(lang, "colModel"), t(lang, "colStore"), t(lang, "colVariant"), t(lang, "colFiles"), t(lang, "colSize")];
// Display width: Hangul and other East Asian wide characters take two terminal columns.
const width = (s) => [...s].reduce((n, ch) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿＀-｠]/.test(ch) ? 2 : 1), 0);
const pad = (s, w) => s + " ".repeat(Math.max(0, w - width(s)));
const widths = header.map((h, c) => Math.max(width(h), ...rows.map((r) => width(r[c]))));
const line = (cells) => cells.map((cell, c) => pad(cell, widths[c])).join("  ").trimEnd();
console.log(line(header));
for (const r of rows) console.log(line(r));
console.log("");
console.log(
  t(lang, "usageLine", {
    usage: formatBytes(result.estimate?.usage ?? null, lang),
    quota: formatBytes(result.estimate?.quota ?? null, lang),
  }),
);

// --- 4. 받기 전 판정 (필요한 바이트와 남은 할당량 비교)
const check = await preflight({ needBytes: need }, { env });
console.log(t(lang, "verdictLine", { verdict: t(lang, "verdict_" + check.verdict) }));
console.log(
  t(lang, "needLine", {
    need: formatBytes(check.needBytes, lang),
    free: formatBytes(check.freeBytes, lang),
    margin: Math.round(check.margin * 100),
  }),
);
console.log(t(lang, "persistLine", { advice: t(lang, "advice_" + check.persistAdvice) }));

// --- 5. 모델 단위 삭제
const removed = await removeModel("Xenova/all-MiniLM-L6-v2", { env });
console.log("");
console.log(
  t(lang, "removedLine", {
    id: "Xenova/all-MiniLM-L6-v2",
    files: removed.filesDeleted,
    bytes: formatBytes(removed.bytesFreed, lang),
  }),
);
console.log(t(lang, "afterLine", { count: (await scan({ env })).models.length }));
