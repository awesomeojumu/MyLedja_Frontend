import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { openKeyValue } from '@/data/kv';

/**
 * PU00-5: open a popup from `?<key>=<value>` and keep a typed draft across refresh.
 * Later sheets pass their param key (plan, move, cover, …) and a JSON-serialisable draft.
 */
export function usePopupParam<TDraft>({
  param,
  openWhen,
  emptyDraft,
  personId,
}: {
  param: string;
  /** Which query values mean "open" (e.g. any non-empty, or specific set). */
  openWhen?: (raw: string) => boolean;
  emptyDraft: TDraft;
  personId?: string | null;
}): {
  open: boolean;
  paramValue: string | null;
  draft: TDraft;
  setDraft: (next: TDraft | ((prev: TDraft) => TDraft)) => void;
  close: () => void;
  openWith: (value: string) => void;
} {
  const router = useRouter();
  const params = useGlobalSearchParams<Record<string, string | string[] | undefined>>();
  const raw = params[param];
  const paramValue = (Array.isArray(raw) ? raw[0] : raw) ?? null;
  const shouldOpen = !!paramValue && (openWhen ? openWhen(paramValue) : true);
  const draftKey = `popup-draft:${param}:${paramValue ?? 'closed'}:${personId ?? 'anon'}`;

  const [draft, setDraftState] = useState<TDraft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!shouldOpen) {
      setDraftState(emptyDraft);
      setHydrated(false);
      return;
    }
    let cancelled = false;
    setHydrated(false);
    void openKeyValue()
      .get(draftKey)
      .then((rawDraft) => {
        if (cancelled) return;
        if (rawDraft) {
          try {
            setDraftState({ ...emptyDraft, ...JSON.parse(rawDraft) });
          } catch {
            setDraftState(emptyDraft);
          }
        } else {
          setDraftState(emptyDraft);
        }
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
    // emptyDraft is a stable default from the caller; re-hydrate when the open key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, shouldOpen]);

  const setDraft = useCallback(
    (next: TDraft | ((prev: TDraft) => TDraft)) => {
      setDraftState((prev) => {
        const value = typeof next === 'function' ? (next as (p: TDraft) => TDraft)(prev) : next;
        if (shouldOpen) void openKeyValue().set([[draftKey, JSON.stringify(value)]]);
        return value;
      });
    },
    [draftKey, shouldOpen],
  );

  const close = useCallback(() => {
    void openKeyValue().remove([draftKey]);
    router.setParams({ [param]: undefined });
  }, [draftKey, param, router]);

  const openWith = useCallback(
    (value: string) => {
      router.setParams({ [param]: value });
    },
    [param, router],
  );

  return useMemo(
    () => ({
      open: shouldOpen,
      paramValue,
      draft: hydrated || !shouldOpen ? draft : emptyDraft,
      setDraft,
      close,
      openWith,
    }),
    [shouldOpen, paramValue, hydrated, draft, emptyDraft, setDraft, close, openWith],
  );
}
