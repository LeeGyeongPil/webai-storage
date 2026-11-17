import { useCallback, useEffect, useRef, useState } from "react";
import { removeModel } from "../remove.js";
import { requestPersist, type PersistResult } from "../persist.js";
import { scan } from "../scan.js";
import type { RemoveResult, ScanResult, StorageAdapter, StorageEnv } from "../types.js";

export interface UseModelStorageOptions {
  env?: StorageEnv;
  adapters?: StorageAdapter[];
}

export interface UseModelStorage {
  result: ScanResult | null;
  loading: boolean;
  error: Error | null;
  /** Set when the last delete failed; cleared by the next delete. */
  removeError: (Error & { id: string }) | null;
  /** Result of the last delete, for "freed X" messages. */
  lastRemoved: (RemoveResult & { id: string }) | null;
  /** Result of the last persist request. */
  lastPersist: PersistResult | null;
  refresh(): Promise<void>;
  /** Resolves true when the model was deleted, false when the delete failed (see removeError). */
  remove(id: string): Promise<boolean>;
  persist(): Promise<void>;
}

/** Scan the origin's model storage and expose delete / persist actions. */
export function useModelStorage(opts: UseModelStorageOptions = {}): UseModelStorage {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [removeError, setRemoveError] = useState<UseModelStorage["removeError"]>(null);
  const [lastRemoved, setLastRemoved] = useState<UseModelStorage["lastRemoved"]>(null);
  const [lastPersist, setLastPersist] = useState<PersistResult | null>(null);
  const alive = useRef(true);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await scan(optsRef.current);
      if (!alive.current) return;
      setResult(next);
      setError(null);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  const remove = useCallback(
    async (id: string) => {
      if (alive.current) setRemoveError(null);
      let ok = true;
      try {
        const done = await removeModel(id, optsRef.current);
        if (alive.current) setLastRemoved({ id, ...done });
      } catch (e) {
        ok = false;
        const err = e instanceof Error ? e : new Error(String(e));
        if (alive.current) setRemoveError(Object.assign(err, { id }));
      }
      // Refresh in both cases so partially deleted files disappear from the list.
      await refresh();
      return ok;
    },
    [refresh],
  );

  const persist = useCallback(async () => {
    const res = await requestPersist(optsRef.current);
    if (alive.current) setLastPersist(res);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  return { result, loading, error, removeError, lastRemoved, lastPersist, refresh, remove, persist };
}
