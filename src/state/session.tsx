import Constants from "expo-constants";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createApiClient } from "@/api/client";
import { readPublicConfig, resolveApiUrl } from "@/lib/config";
import { secureTokenStore } from "@/lib/secure-token-store";
import { SessionCore, type SessionState } from "@/lib/session-core";

const SessionContext = createContext<SessionCore | null>(null);

function createSession(): SessionCore {
  const config = readPublicConfig();
  const baseUrl =
    config.appEnv === "development" ? resolveApiUrl(config.apiUrl, Constants.expoConfig?.hostUri) : config.apiUrl;
  return new SessionCore(createApiClient(baseUrl, (url, init) => fetch(url, init)), secureTokenStore());
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session] = useState(createSession);
  useEffect(() => {
    void session.restore();
  }, [session]);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState & { session: SessionCore } {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  return { ...state, session };
}

/**
 * Remounts everything below it when the signed-in user changes, so no screen state, cache or draft from one
 * user can show up for the next.
 */
export function UserScope({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return <UserKeyed key={user?.userId ?? "signed-out"}>{children}</UserKeyed>;
}

function UserKeyed({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
