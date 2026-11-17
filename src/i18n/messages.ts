import { InvalidInputError } from "../errors.js";
import type { Lang } from "../types.js";

export const LANGS: Lang[] = ["en", "ko"];
export const LANG_STORAGE_KEY = "webai-storage.lang";

/** All user-visible strings live here. `{name}` placeholders are filled by `t()`. */
export const messages = {
  en: {
    panelTitle: "Stored AI models",
    language: "Language",
    usage: "Storage used (approximate)",
    usageUnknown: "Storage estimate is not available in this browser.",
    usageValue: "{usage} of {quota} ({percent}%)",
    persistedYes: "Persistent storage: granted",
    persistedNo: "Persistent storage: not granted",
    persistedUnknown: "Persistent storage: unknown",
    persistButton: "Request persistent storage",
    persistGranted: "Granted. The browser will keep this site's data under storage pressure.",
    persistDenied:
      "Not granted. The browser decides on its own (Chrome and Safari use visit history, Firefox asks you); this is not an error.",
    persistUnsupported: "This browser does not support persistent storage.",
    empty: "No stored models found.",
    loading: "Scanning storage...",
    errorPrefix: "Could not scan storage",
    removeFailed: "Could not delete {id}: {reason}. Close other tabs using this model and try again.",
    refresh: "Refresh",
    delete: "Delete",
    confirmDelete: "Yes, delete",
    cancel: "Cancel",
    confirmHint: "Pages using this model in another tab may break.",
    freed: "Freed {bytes} ({files} files).",
    partial: "partial",
    partialHint: "Some files are incomplete downloads.",
    filesCount: "{count} files",
    unknownSizeFiles: "{count} files of unknown size",
    skipped: "Skipped stores: {list}",
    mockBanner: "Practice mock: in-memory fake storage seeded with recorded real layouts",
    colModel: "Model",
    colStore: "Store",
    colVariant: "Variant",
    colFiles: "Files",
    colSize: "Size",
    usageLine: "Usage: {usage} of {quota} (approximate)",
    verdictLine: "Verdict: {verdict}",
    needLine: "Need: {need}, free: {free}, margin: {margin}%",
    persistLine: "Persist advice: {advice}",
    removedLine: "Removed {id}: {files} files, freed {bytes}",
    afterLine: "Models left: {count}",
    verdict_fits: "fits",
    verdict_tight: "tight",
    verdict_insufficient: "insufficient",
    verdict_unknown: "unknown",
    advice_none: "none",
    advice_recommend: "recommend",
    advice_already: "already",
    badLang: "--lang must be en or ko",
  },
  ko: {
    panelTitle: "저장된 AI 모델",
    language: "언어",
    usage: "저장소 사용량 (근사치)",
    usageUnknown: "이 브라우저는 저장소 추정치를 제공하지 않습니다.",
    usageValue: "{quota} 중 {usage} ({percent}%)",
    persistedYes: "영구 저장: 허용됨",
    persistedNo: "영구 저장: 허용되지 않음",
    persistedUnknown: "영구 저장: 알 수 없음",
    persistButton: "영구 저장 요청",
    persistGranted: "허용되었습니다. 저장소가 부족해도 브라우저가 이 사이트의 데이터를 유지합니다.",
    persistDenied:
      "허용되지 않았습니다. 브라우저가 스스로 판단합니다(Chrome·Safari 는 방문 이력, Firefox 는 팝업). 오류가 아닙니다.",
    persistUnsupported: "이 브라우저는 영구 저장을 지원하지 않습니다.",
    empty: "저장된 모델이 없습니다.",
    loading: "저장소를 검사하는 중...",
    errorPrefix: "저장소를 검사하지 못했습니다",
    removeFailed: "{id} 을(를) 삭제하지 못했습니다: {reason}. 이 모델을 쓰는 다른 탭을 닫고 다시 시도하세요.",
    refresh: "새로고침",
    delete: "삭제",
    confirmDelete: "네, 삭제합니다",
    cancel: "취소",
    confirmHint: "다른 탭에서 이 모델을 쓰는 페이지가 깨질 수 있습니다.",
    freed: "{bytes} 확보 (파일 {files}개).",
    partial: "불완전",
    partialHint: "일부 파일이 끝까지 내려받아지지 않았습니다.",
    filesCount: "파일 {count}개",
    unknownSizeFiles: "크기를 모르는 파일 {count}개",
    skipped: "건너뛴 저장소: {list}",
    mockBanner: "연습용 목: 기록한 실제 레이아웃을 채운 메모리 가짜 저장소",
    colModel: "모델",
    colStore: "저장소",
    colVariant: "변형",
    colFiles: "파일",
    colSize: "크기",
    usageLine: "사용량: {quota} 중 {usage} (근사치)",
    verdictLine: "판정: {verdict}",
    needLine: "필요: {need}, 여유: {free}, 여유율: {margin}%",
    persistLine: "영구 저장 권고: {advice}",
    removedLine: "{id} 삭제: 파일 {files}개, {bytes} 확보",
    afterLine: "남은 모델: {count}개",
    verdict_fits: "받을 수 있음",
    verdict_tight: "빠듯함",
    verdict_insufficient: "공간 부족",
    verdict_unknown: "알 수 없음",
    advice_none: "필요 없음",
    advice_recommend: "권장",
    advice_already: "이미 허용됨",
    badLang: "--lang 은 en 또는 ko 여야 합니다",
  },
} as const;

export type MessageKey = keyof (typeof messages)["en"];

/** Look up a message and fill `{name}` placeholders. */
export function t(lang: Lang, key: MessageKey, params: Record<string, string | number> = {}): string {
  const text: string = messages[lang][key];
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

function toLang(value: string | undefined | null): Lang | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "") return null;
  return v.startsWith("ko") ? "ko" : "en";
}

/**
 * Command-line language order: `--lang` flag, then WEBAI_STORAGE_LANG, then
 * LC_ALL, LC_MESSAGES, LANG. Anything that is not Korean means English.
 */
export function resolveLang(flag: string | undefined, env: Record<string, string | undefined>): Lang {
  if (flag !== undefined) {
    if (flag !== "en" && flag !== "ko") throw new InvalidInputError(`${messages.en.badLang} (got "${flag}")`);
    return flag;
  }
  const own = env.WEBAI_STORAGE_LANG?.trim();
  if (own === "en" || own === "ko") return own;
  return toLang(env.LC_ALL) ?? toLang(env.LC_MESSAGES) ?? toLang(env.LANG) ?? "en";
}

/** First-visit language for UIs: Korean when the browser language starts with "ko". */
export function detectBrowserLang(language: string | undefined | null): Lang {
  return toLang(language) ?? "en";
}
