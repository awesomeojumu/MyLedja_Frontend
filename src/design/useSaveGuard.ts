import { useCallback, useRef, useState } from 'react';

/**
 * PU00-3: main button stays disabled until `valid`, and can't save twice while a save is in flight.
 */
export function useSaveGuard(valid: boolean) {
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const canSave = valid && !saving;
  const runSave = useCallback(
    async (fn: () => void | Promise<void>) => {
      if (!valid || busy.current) return;
      busy.current = true;
      setSaving(true);
      try {
        await fn();
      } finally {
        busy.current = false;
        setSaving(false);
      }
    },
    [valid],
  );

  return { canSave, saving, runSave };
}
