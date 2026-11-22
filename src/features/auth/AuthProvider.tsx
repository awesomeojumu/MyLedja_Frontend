import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { authApi, type SessionResponse, type User, type Workspace } from '../../api/auth';
import { ApiClient, fetchTransport, NetworkError } from '../../api/client';
import { createAuthMock } from '../../api/mocks/auth';
import { config } from '../../config';
import { createSessionStore } from '../../data/session';
import { openKeyValue } from '../../data/kv';

export type AuthStatus = 'signed-in' | 'signed-out' | 'loading';
export type ApiSource = 'mock' | 'local' | 'staging';

export interface AuthContextType {
  user: User | null;
  workspaceId: string | null;
  workspaces: Workspace[];
  status: AuthStatus;
  source: ApiSource;
  client: ApiClient;
  isAuthenticated: boolean;
  isLoading: boolean;
  setSession: (user: User, workspaceId?: string | null, workspaces?: Workspace[]) => Promise<void>;
  /** After sign in, sign up or two-factor: keep the tokens and the person. */
  signedIn: (res: SessionResponse, staySignedIn: boolean) => Promise<void>;
  setWorkspaceId: (workspaceId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_USER_KEY = 'auth:user';
const AUTH_WORKSPACE_KEY = 'auth:workspaceId';

/**
 * Where the app talks to. With EXPO_PUBLIC_API_URL set it's the real backend; without it the app runs on the
 * built-in mock (demo person in src/api/mocks/auth.ts), which also keeps tests and offline demos working.
 */
function apiSource(): ApiSource {
  if (!config.apiUrl) return 'mock';
  return config.appEnv === 'development' ? 'local' : 'staging';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [source] = useState<ApiSource>(apiSource);

  const session = useMemo(() => createSessionStore(), []);
  const client = useMemo(
    () => new ApiClient(config.apiUrl ? fetchTransport(config.apiUrl) : createAuthMock().transport, session),
    [session],
  );

  const remember = async (u: User | null, ws: string | null) => {
    try {
      const kv = openKeyValue('myledja');
      if (u && ws) {
        await kv.set([
          [AUTH_USER_KEY, JSON.stringify(u)],
          [AUTH_WORKSPACE_KEY, ws],
        ]);
      } else {
        await kv.remove([AUTH_USER_KEY, AUTH_WORKSPACE_KEY]);
      }
    } catch {
      // Storage errors are not fatal; the session lives in memory for this run.
    }
  };

  // On open: resume the stored session with the refresh token (or cookie). Offline, keep the stored user so
  // the app still opens on this device's copy; signed out on the server, start at Sign in.
  useEffect(() => {
    let alive = true;
    async function resume() {
      let stored: User | null = null;
      let storedWorkspace: string | null = null;
      try {
        const kv = openKeyValue('myledja');
        const raw = await kv.get(AUTH_USER_KEY);
        stored = raw ? (JSON.parse(raw) as User) : null;
        storedWorkspace = await kv.get(AUTH_WORKSPACE_KEY);
      } catch {
        stored = null;
      }
      try {
        const refreshed = await client.refresh();
        if (!alive) return;
        if (refreshed) {
          const me = await authApi(client).me();
          if (!alive) return;
          const ws = storedWorkspace && stored?.id === me.id ? storedWorkspace : me.workspaceId;
          setUser(me);
          setWorkspaceIdState(ws);
          await remember(me, ws);
        } else {
          setUser(null);
          setWorkspaceIdState(null);
          await remember(null, null);
        }
      } catch (err) {
        if (!alive) return;
        if (err instanceof NetworkError && stored) {
          setUser(stored);
          setWorkspaceIdState(storedWorkspace ?? stored.workspaceId);
        } else {
          setUser(null);
          setWorkspaceIdState(null);
        }
      } finally {
        if (alive) setIsLoading(false);
      }
    }
    void resume();
    return () => {
      alive = false;
    };
  }, [client]);

  const setSession = async (newUser: User, activeWorkspaceId?: string | null, newWorkspaces?: Workspace[]) => {
    const resolvedWorkspace = activeWorkspaceId ?? newUser.workspaceId;
    setUser(newUser);
    setWorkspaceIdState(resolvedWorkspace);
    if (newWorkspaces) setWorkspaces(newWorkspaces);
    await remember(newUser, resolvedWorkspace);
  };

  const signedIn = async (res: SessionResponse, staySignedIn: boolean) => {
    await client.signedIn(res, staySignedIn);
    await setSession(res.user, res.user.workspaceId);
  };

  const setWorkspaceId = async (id: string) => {
    setWorkspaceIdState(id);
    if (user) await remember(user, id);
  };

  const signOut = async () => {
    try {
      if (client.hasAccessToken()) await authApi(client).signOut();
    } catch {
      // Signing out on this device goes ahead even if the server can't be reached.
    }
    await client.signOut();
    setUser(null);
    setWorkspaceIdState(null);
    setWorkspaces([]);
    await remember(null, null);
  };

  const status: AuthStatus = isLoading ? 'loading' : user ? 'signed-in' : 'signed-out';

  const value = useMemo(
    () => ({
      user,
      workspaceId,
      workspaces,
      status,
      source,
      client,
      isAuthenticated: !!user,
      isLoading,
      setSession,
      signedIn,
      setWorkspaceId,
      signOut,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, workspaceId, workspaces, status, source, client, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    const session = createSessionStore();
    return {
      user: null,
      workspaceId: 'default',
      workspaces: [],
      status: 'signed-out',
      source: 'mock',
      client: new ApiClient(fetchTransport('http://localhost:3000'), session),
      isAuthenticated: false,
      isLoading: false,
      setSession: async () => {},
      signedIn: async () => {},
      setWorkspaceId: async () => {},
      signOut: async () => {},
    };
  }
  return context;
}
