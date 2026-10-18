import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { onMoneyWrite } from "@/lib/after-money";
import { readCache, scopedKey, writeCache } from "@/lib/offline-cache";
import { useSession } from "@/state";

export interface LiveQuery<T> {
  data: T;
  /** First load with nothing to show yet. Screens show a skeleton, never an empty list or ₦0. */
  loading: boolean;
  /** The server is unreachable. `data` is the last copy saved on this device, if any. */
  offline: boolean;
  /** A non-network failure, in words a person can act on. */
  error: string | null;
  /** True once real data (live or cached) has been shown, so an empty list is a real empty. */
  known: boolean;
  refresh: () => void;
}

/**
 * Loads workspace data on focus and after every money write. The last good result is kept per user and workspace
 * (in memory and on the device), so a flaky or missing connection shows the user's real records with an offline
 * note instead of an empty list.
 */
export function useLiveQuery<T>(load: (workspaceId: string) => Promise<T>, empty: T, cacheKey?: string): LiveQuery<T> {
  const { status, workspaces, user } = useSession();
  const workspaceId = workspaces[0]?.id;
  const key = cacheKey && user && workspaceId ? scopedKey(user.userId, workspaceId, cacheKey) : null;
  const [initial] = useState(() => (key ? readCache<T>(key) : null));
  const [data, setData] = useState<T>(() => initial ?? empty);
  const [known, setKnown] = useState(initial != null);
  const [loading, setLoading] = useState(initial == null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownKey = useRef(key);

  const refresh = useCallback(() => {
    if (status !== "signedIn" || !workspaceId) {
      setLoading(status === "loading");
      return;
    }
    if (shownKey.current !== key) {
      shownKey.current = key;
      const next = key ? readCache<T>(key) : null;
      setData(next ?? empty);
      setKnown(next != null);
      setLoading(next == null);
    }
    void load(workspaceId)
      .then((next) => {
        if (key) writeCache(key, next);
        setData(next);
        setKnown(true);
        setOffline(false);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 0) {
          setOffline(true);
          setError(null);
        } else {
          setError(caught instanceof Error && caught.message ? caught.message : "Something went wrong. Try again.");
        }
      })
      .finally(() => setLoading(false));
  }, [empty, key, load, status, workspaceId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return onMoneyWrite(() => {
        refresh();
      });
    }, [refresh]),
  );

  return { data, loading, offline, error, known, refresh };
}
