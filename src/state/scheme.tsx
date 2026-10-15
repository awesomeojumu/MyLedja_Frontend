import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Scheme = "light" | "dark" | undefined;

const SchemeContext = createContext<{
  scheme: Scheme;
  setScheme: (scheme: Scheme) => void;
}>({ scheme: undefined, setScheme: () => undefined });

export function SchemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setScheme] = useState<Scheme>();
  const value = useMemo(() => ({ scheme, setScheme }), [scheme]);
  return <SchemeContext.Provider value={value}>{children}</SchemeContext.Provider>;
}

export function useScheme() {
  return useContext(SchemeContext);
}
