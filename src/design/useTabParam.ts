import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { openKeyValue } from '@/data/kv';

/**
 * Shared tab / segmented view state (addendum §3):
 * - URL `?tab=<key>` so a link or refresh opens the same tab
 * - last tab remembered per page key and person (device store)
 * - switching is local-only (instant)
 */
export function useTabParam<T extends string>({
  pageKey,
  personId,
  options,
  defaultValue,
  param = 'tab',
}: {
  pageKey: string;
  personId?: string | null;
  options: readonly T[];
  defaultValue: T;
  param?: string;
}): { value: T; setValue: (next: T) => void; options: readonly T[] } {
  const router = useRouter();
  const params = useGlobalSearchParams<Record<string, string | string[] | undefined>>();
  const raw = params[param];
  const fromUrl = (Array.isArray(raw) ? raw[0] : raw) as T | undefined;
  const allowed = useMemo(() => new Set(options), [options]);
  const urlValue = fromUrl && allowed.has(fromUrl) ? fromUrl : null;

  const storageKey = `tab:${pageKey}:${personId ?? 'anon'}`;
  const [remembered, setRemembered] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      void openKeyValue()
        .get(storageKey)
        .then((v) => {
          if (cancelled) return;
          if (v && allowed.has(v as T)) setRemembered(v as T);
        })
        .catch(() => {
          /* memory-only when the device store isn't available (tests / blocked storage) */
        });
    } catch {
      /* Jest iOS resolves kv.native; SQLite isn't available in unit tests. */
    }
    return () => {
      cancelled = true;
    };
  }, [storageKey, allowed]);

  const value = (urlValue ?? remembered ?? defaultValue) as T;

  const setValue = useCallback(
    (next: T) => {
      if (!allowed.has(next)) return;
      setRemembered(next);
      try {
        void openKeyValue()
          .set([[storageKey, next]])
          .catch(() => {});
      } catch {
        /* ignore missing native store */
      }
      router.setParams({ [param]: next });
    },
    [allowed, param, router, storageKey],
  );

  // Keep URL in sync when we fell back to remembered/default (refresh with no ?tab=).
  useEffect(() => {
    if (urlValue) return;
    router.setParams({ [param]: value });
  }, [param, router, urlValue, value]);

  return { value, setValue, options };
}
