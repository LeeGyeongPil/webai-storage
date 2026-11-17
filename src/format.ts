import type { Lang } from "./types.js";

const UNITS = ["B", "KB", "MB", "GB", "TB"];

/** Decimal units (1 MB = 1,000,000 B): 23685047 -> "23.7 MB". */
export function formatBytes(n: number | null, lang: Lang = "en"): string {
  if (n === null || !Number.isFinite(n) || n < 0) return lang === "ko" ? "알 수 없음" : "unknown";
  if (n < 1000) return `${Math.round(n)} B`;
  let value = n;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(1)} ${UNITS[unit]}`;
}
