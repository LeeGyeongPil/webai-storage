import { describe, expect, it } from "vitest";
import { InvalidInputError, detectBrowserLang, messages, resolveLang, t } from "../src/index.js";

describe("i18n (AC-8)", () => {
  it("has identical key sets in en and ko, with no empty strings", () => {
    expect(Object.keys(messages.ko).sort()).toEqual(Object.keys(messages.en).sort());
    for (const lang of ["en", "ko"] as const) {
      for (const [key, value] of Object.entries(messages[lang])) expect(value, lang + "." + key).not.toBe("");
    }
  });

  it("uses the same placeholders in both languages", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(messages.en) as (keyof typeof messages.en)[]) {
      expect(names(messages.ko[key]), key).toEqual(names(messages.en[key]));
    }
  });

  it("fills placeholders", () => {
    expect(t("en", "filesCount", { count: 4 })).toBe("4 files");
    expect(t("ko", "filesCount", { count: 4 })).toBe("파일 4개");
  });

  it("resolves the CLI language in the documented order", () => {
    expect(resolveLang("ko", { WEBAI_STORAGE_LANG: "en", LANG: "en_US" })).toBe("ko");
    expect(resolveLang(undefined, { WEBAI_STORAGE_LANG: "ko", LC_ALL: "en_US.UTF-8" })).toBe("ko");
    expect(resolveLang(undefined, { LC_ALL: "ko_KR.UTF-8", LC_MESSAGES: "en_US", LANG: "en_US" })).toBe("ko");
    expect(resolveLang(undefined, { LC_ALL: "", LC_MESSAGES: "ko_KR.UTF-8", LANG: "en_US" })).toBe("ko");
    expect(resolveLang(undefined, { LANG: "ko_KR.UTF-8" })).toBe("ko");
    expect(resolveLang(undefined, { LC_ALL: "C", LANG: "ko_KR.UTF-8" })).toBe("en");
    expect(resolveLang(undefined, { WEBAI_STORAGE_LANG: "garbage", LANG: "ko_KR" })).toBe("ko");
    expect(resolveLang(undefined, {})).toBe("en");
    expect(resolveLang(undefined, { LANG: "de_DE.UTF-8" })).toBe("en");
  });

  it("rejects an unsupported --lang value", () => {
    expect(() => resolveLang("fr", {})).toThrow(InvalidInputError);
  });

  it("detects browser language", () => {
    expect(detectBrowserLang("ko-KR")).toBe("ko");
    expect(detectBrowserLang("en-US")).toBe("en");
    expect(detectBrowserLang(undefined)).toBe("en");
  });
});
