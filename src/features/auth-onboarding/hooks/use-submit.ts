import { useCallback, useState } from "react";

/** Runs one async action at a time and keeps a user-safe error message. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}
