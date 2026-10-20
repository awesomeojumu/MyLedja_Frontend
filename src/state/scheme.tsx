import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { readCache, writeCache } from "@/lib/offline-cache";

type Scheme = "light" | "dark" | undefined;

/** Device preferences, kept on this device across restarts (not per account). */
const PREFS_KEY = "myledja.device-prefs";
interface DevicePrefs {
  /** "system" follows the phone. */
  scheme?: "light" | "dark" | "system";
  haptics?: boolean;
}

function readPrefs(): DevicePrefs {
  return readCache<DevicePrefs>(PREFS_KEY) ?? {};
}

const SchemeContext = createContext<{
  scheme: Scheme;
  setScheme: (scheme: Scheme) => void;
  haptics: boolean;
  setHaptics: (on: boolean) => void;
}>({ scheme: undefined, setScheme: () => undefined, haptics: true, setHaptics: () => undefined });

export function SchemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<Scheme>(() => {
    const saved = readPrefs().scheme;
    // Light until someone chooses otherwise, as before preferences were saved.
    return saved === "system" ? undefined : saved ?? "light";
  });
  const [haptics, setHapticsState] = useState<boolean>(() => readPrefs().haptics !== false);
  const setScheme = useCallback((next: Scheme) => {
    setSchemeState(next);
    writeCache(PREFS_KEY, { ...readPrefs(), scheme: next ?? "system" });
  }, []);
  const setHaptics = useCallback((on: boolean) => {
    setHapticsState(on);
    writeCache(PREFS_KEY, { ...readPrefs(), haptics: on });
  }, []);
  const value = useMemo(() => ({ scheme, setScheme, haptics, setHaptics }), [scheme, setScheme, haptics, setHaptics]);
  return <SchemeContext.Provider value={value}>{children}</SchemeContext.Provider>;
}

export function useScheme() {
  return useContext(SchemeContext);
}
