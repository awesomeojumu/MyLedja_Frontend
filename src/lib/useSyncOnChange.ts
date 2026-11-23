import { useState } from 'react';

/**
 * Runs `sync` while rendering, the first time and whenever one of `deps` changes (compared with Object.is).
 * Use it to reset a sheet's fields from its props when it opens, instead of calling setState in an effect,
 * which renders twice. `sync` may only set this component's own state.
 */
export function useSyncOnChange(deps: readonly unknown[], sync: () => void): void {
  const [seen, setSeen] = useState<readonly unknown[] | null>(null);
  const changed = seen === null || seen.length !== deps.length || deps.some((d, i) => !Object.is(d, seen[i]));
  if (changed) {
    setSeen(deps);
    sync();
  }
}
