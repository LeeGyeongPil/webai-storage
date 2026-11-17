import { detectVariant } from "./variant.js";

export const DEFAULT_HOSTS = ["huggingface.co", "hf-mirror.com"];

export interface ParsedModelUrl {
  id: string;
  revision: string | null;
  file: string;
  variant: string | null;
}

/**
 * Parse `https://<host>/<org>/<repo>/resolve/<revision>/<file>`.
 * Returns null for anything else so the caller can file it under "(other)".
 */
export function parseModelUrl(url: string, hosts: string[] = DEFAULT_HOSTS): ParsedModelUrl | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!hosts.includes(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean).map((p) => safeDecode(p));
  const at = parts.indexOf("resolve");
  if (at < 1 || at > 2) return null;
  const revision = parts[at + 1];
  const fileParts = parts.slice(at + 2);
  if (!revision || fileParts.length === 0) return null;
  const id = parts.slice(0, at).join("/");
  const file = fileParts.join("/");
  return { id, revision, file, variant: detectVariant(id, file) };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
