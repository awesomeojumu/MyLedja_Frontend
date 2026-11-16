import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { User, Workspace } from '../../api/auth';
import { ApiClient, fetchTransport } from '../../api/client';
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
  setWorkspaceId: (workspaceId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_USER_KEY = 'auth:user';
const AUTH_WORKSPACE_KEY = 'auth:workspaceId';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<ApiSource>('mock');

  const session = useMemo(() => createSessionStore(), []);
  const client = useMemo(
    () => new ApiClient(fetchTransport(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'), session),
    [session]
  );

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const kv = openKeyValue('myledja');
        const storedUser = await kv.get(AUTH_USER_KEY);
        const storedWorkspace = await kv.get(AUTH_WORKSPACE_KEY);

        if (storedUser) {
          const parsedUser = JSON.parse(storedUser) as User;
          setUser(parsedUser);
          setWorkspaceIdState(storedWorkspace ?? parsedUser.workspaceId ?? 'default');
        }
      } catch {
        // Fallback to unauthenticated
      } finally {
        setIsLoading(false);
      }
    }
    loadStoredAuth();
  }, []);

  const setSession = async (newUser: User, activeWorkspaceId?: string | null, newWorkspaces?: Workspace[]) => {
    setUser(newUser);
    const resolvedWorkspace = activeWorkspaceId ?? newUser.workspaceId ?? 'default';
    setWorkspaceIdState(resolvedWorkspace);
    if (newWorkspaces) setWorkspaces(newWorkspaces);

    try {
      const kv = openKeyValue('myledja');
      await kv.set([
        [AUTH_USER_KEY, JSON.stringify(newUser)],
        [AUTH_WORKSPACE_KEY, resolvedWorkspace],
      ]);
    } catch {
      // Storage error non-fatal
    }
  };

  const setWorkspaceId = async (id: string) => {
    setWorkspaceIdState(id);
    try {
      const kv = openKeyValue('myledja');
      await kv.set([[AUTH_WORKSPACE_KEY, id]]);
    } catch {
      // Non-fatal
    }
  };

  const signOut = async () => {
    setUser(null);
    setWorkspaceIdState(null);
    setWorkspaces([]);
    try {
      const kv = openKeyValue('myledja');
      await kv.remove([AUTH_USER_KEY, AUTH_WORKSPACE_KEY]);
    } catch {
      // Non-fatal
    }
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
      setWorkspaceId,
      signOut,
    }),
    [user, workspaceId, workspaces, status, source, client, isLoading]
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
      setWorkspaceId: async () => {},
      signOut: async () => {},
    };
  }
  return context;
}
