import { useState, type CSSProperties } from "react";
import { formatBytes } from "../format.js";
import { LANGS, LANG_STORAGE_KEY, detectBrowserLang, t, type MessageKey } from "../i18n/messages.js";
import type { Lang, StorageAdapter, StorageEnv } from "../types.js";
import { useModelStorage } from "./use-model-storage.js";

export interface ModelStoragePanelProps {
  /** Fixed language. When omitted the panel shows a language menu and remembers the choice. */
  lang?: Lang;
  env?: StorageEnv;
  adapters?: StorageAdapter[];
  /** Called after a model was deleted. */
  onRemoved?: (id: string) => void;
}

const LANG_NAMES: Record<Lang, string> = { en: "English", ko: "한국어" };

function readStoredLang(): Lang {
  try {
    const stored = globalThis.localStorage?.getItem(LANG_STORAGE_KEY);
    if (stored === "en" || stored === "ko") return stored;
  } catch {
    // localStorage can be blocked; fall through to detection.
  }
  return detectBrowserLang(globalThis.navigator?.language);
}

function storeLang(lang: Lang): void {
  try {
    globalThis.localStorage?.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Not persisted, the choice still applies until reload.
  }
}

const box: CSSProperties = { fontFamily: "system-ui, sans-serif", maxWidth: 640 };
const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  padding: "6px 0",
  borderBottom: "1px solid #ddd",
};
const badge: CSSProperties = {
  background: "#fde68a",
  color: "#78350f",
  borderRadius: 4,
  padding: "0 6px",
  marginLeft: 6,
  fontSize: 12,
};

/** Settings panel: stored models (largest first), usage bar, delete and persist buttons. */
export function ModelStoragePanel(props: ModelStoragePanelProps) {
  const [chosen, setChosen] = useState<Lang>(readStoredLang);
  const lang = props.lang ?? chosen;
  const tr = (key: MessageKey, params?: Record<string, string | number>) => t(lang, key, params);
  const { result, loading, error, removeError, lastRemoved, lastPersist, remove, persist } = useModelStorage({
    env: props.env,
    adapters: props.adapters,
  });
  const [confirming, setConfirming] = useState<string | null>(null);

  const estimate = result?.estimate ?? null;
  const usage = estimate?.usage;
  const quota = estimate?.quota;
  const percent = usage !== undefined && quota ? Math.min(100, Math.round((usage / quota) * 100)) : null;

  const persistMessage = lastPersist
    ? !lastPersist.supported
      ? tr("persistUnsupported")
      : lastPersist.granted
        ? tr("persistGranted")
        : tr("persistDenied")
    : null;
  const persistedLabel =
    result?.persisted === true ? tr("persistedYes") : result?.persisted === false ? tr("persistedNo") : tr("persistedUnknown");

  return (
    <section style={box} aria-label={tr("panelTitle")}>
      <div style={row}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{tr("panelTitle")}</h2>
        {props.lang === undefined && (
          <label>
            {tr("language")}{" "}
            <select
              aria-label={tr("language")}
              value={chosen}
              onChange={(e) => {
                const next = e.target.value as Lang;
                storeLang(next);
                setChosen(next);
              }}
            >
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {LANG_NAMES[l]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div style={{ margin: "12px 0" }}>
        <div>{tr("usage")}</div>
        {percent !== null && usage !== undefined && quota ? (
          <>
            <div
              role="progressbar"
              aria-label={tr("usage")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              style={{ background: "#e5e7eb", height: 10, borderRadius: 5, overflow: "hidden" }}
            >
              <div style={{ width: percent + "%", height: "100%", background: percent > 85 ? "#dc2626" : "#2563eb" }} />
            </div>
            <small>{tr("usageValue", { usage: formatBytes(usage, lang), quota: formatBytes(quota, lang), percent })}</small>
          </>
        ) : (
          <small>{tr("usageUnknown")}</small>
        )}
      </div>

      <div style={{ margin: "12px 0" }}>
        <span>{persistedLabel}</span>{" "}
        <button type="button" disabled={result?.persisted === true} onClick={() => void persist()}>
          {tr("persistButton")}
        </button>
        {persistMessage && <p role="status">{persistMessage}</p>}
      </div>

      {loading && !result && <p>{tr("loading")}</p>}
      {error && (
        <p role="alert">
          {tr("errorPrefix")}: {error.message}
        </p>
      )}
      {removeError && (
        <p role="alert">{tr("removeFailed", { id: removeError.id, reason: removeError.message })}</p>
      )}
      {result && result.models.length === 0 && <p>{tr("empty")}</p>}
      {lastRemoved && (
        <p role="status">
          {lastRemoved.id}: {tr("freed", { bytes: formatBytes(lastRemoved.bytesFreed, lang), files: lastRemoved.filesDeleted })}
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {result?.models.map((m) => (
          <li key={m.id} style={row} data-model={m.id}>
            <div>
              <strong>{m.id}</strong>
              {m.partial && (
                <span style={badge} title={tr("partialHint")}>
                  {tr("partial")}
                </span>
              )}
              <div>
                <small>
                  {[m.variants.join(", "), m.stores.join(", "), tr("filesCount", { count: m.files }), formatBytes(m.bytes, lang)]
                    .filter(Boolean)
                    .join(" · ")}
                  {m.unknownSizeFiles > 0 ? " · " + tr("unknownSizeFiles", { count: m.unknownSizeFiles }) : ""}
                </small>
              </div>
            </div>
            {confirming === m.id ? (
              <span>
                <small>{tr("confirmHint")}</small>{" "}
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(null);
                    void remove(m.id).then((ok) => {
                      if (ok) props.onRemoved?.(m.id);
                    });
                  }}
                >
                  {tr("confirmDelete")}
                </button>{" "}
                <button type="button" onClick={() => setConfirming(null)}>
                  {tr("cancel")}
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(m.id)}>
                {tr("delete")}
              </button>
            )}
          </li>
        ))}
      </ul>

      {result && result.skipped.length > 0 && (
        <small>{tr("skipped", { list: result.skipped.map((s) => s.store).join(", ") })}</small>
      )}
    </section>
  );
}
