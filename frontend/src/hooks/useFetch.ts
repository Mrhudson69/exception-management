import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

interface FetchOptions {
  /** If set (>0), silently re-fetches on this interval (ms). Pauses when the tab is hidden. */
  pollMs?: number;
}

export function useFetch<T>(path: string | null, deps: unknown[] = [], options: FetchOptions = {}) {
  const { pollMs } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // `silent` skips the loading spinner — used by background polling so the UI doesn't flicker.
  const load = useCallback(
    async (silent = false) => {
      if (!path) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        setData(await api.get<T>(path));
        setLastUpdated(Date.now());
      } catch (e: any) {
        setError(e.message ?? "Failed to load");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [path]
  );

  const refetch = useCallback(() => load(false), [load]);

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps.length ? deps : [path]);

  // Auto-refresh: silent polling that pauses while the tab is hidden and
  // fires an immediate refresh when the user returns to the tab.
  useEffect(() => {
    if (!pollMs || !path) return;
    const id = setInterval(() => {
      if (!document.hidden) load(true);
    }, pollMs);
    const onVisible = () => {
      if (!document.hidden) load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs, path]);

  return { data, loading, error, refetch, setData, lastUpdated };
}
