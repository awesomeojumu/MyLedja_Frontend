import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { onMoneyWrite } from "@/lib/after-money";
import { useSession } from "@/state";

const cache = new Map<string, unknown>();

export function useLiveQuery<T>(
  load: (workspaceId: string) => Promise<T>,
  empty: T,
  cacheKey?: string,
): {
  data: T;
  loading: boolean;
} {
  const { status, workspaces } = useSession();
  const fallback = useRef(empty);
  const hadData = useRef(false);
  const [data, setData] = useState<T>(() => {
    if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey) as T;
    return empty;
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (status !== "signedIn" || !workspaces[0]) {
      setData(fallback.current);
      setLoading(false);
      return;
    }
    if (!hadData.current && !(cacheKey && cache.has(cacheKey))) setLoading(true);
    void load(workspaces[0].id)
      .then((next) => {
        hadData.current = true;
        if (cacheKey) cache.set(cacheKey, next);
        setData(next);
      })
      .catch(() => {
        if (!hadData.current) setData(fallback.current);
      })
      .finally(() => setLoading(false));
  }, [cacheKey, load, status, workspaces]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return onMoneyWrite(() => {
        refresh();
      });
    }, [refresh]),
  );

  return { data, loading };
}
