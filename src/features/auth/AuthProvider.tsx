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

export const DEV_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJzaWQiOiI5MDM5Y2MzYy1mOGY2LTRlOGYtYTk5YS03ODc2YmI1MjQ5NWYiLCJ0eXAiOiJhY2Nlc3MiLCJzdWIiOiIwMWExZDNmMC0xMjFiLTc3NGEtOWFkOS1lZjNjM2NmODYxYTMiLCJpc3MiOiJteWxlZGphIiwiYXVkIjoibXlsZWRqYS1hcHAiLCJpYXQiOjE3OTQ4NDExNDksImV4cCI6MTgwMjYxNzE0OX0.Y69kdsLcS0WfTt0oApf5dbsILqCJhnGJj0uwYVA8vvk';
export const DEV_REFRESH_TOKEN =
  '9039cc3c-f8f6-4e8f-a99a-7876bb52495f.qf4vbps0G4rYR0KcdlRov3U-S0HVGktffJcRehy5JcU';

export const DEV_USER: User = {
  id: '01a1d3f0-121b-774a-9ad9-ef3c3cf861a3',
  name: 'Awesome Ojumu',
  email: 'ayobamiojumu@gmail.com',
  setupComplete: true,
  workspaceId: '01a1d3f0-b2ae-7433-98e3-d2b16c4125b3',
  workspaceName: 'Personal',
};
export const DEV_WORKSPACE_ID = '01a1d3f0-b2ae-7433-98e3-d2b16c4125b3';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<ApiSource>('local');

  const session = useMemo(() => createSessionStore(), []);
  const client = useMemo(
    () =>
      new ApiClient(
        fetchTransport(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000'),
        session
      ),
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
          setWorkspaceIdState(storedWorkspace ?? parsedUser.workspaceId ?? DEV_WORKSPACE_ID);
        } else {
          // Default to live MongoDB workspace and authenticated user
          setUser(DEV_USER);
          setWorkspaceIdState(DEV_WORKSPACE_ID);
          await kv.set([
            [AUTH_USER_KEY, JSON.stringify(DEV_USER)],
            [AUTH_WORKSPACE_KEY, DEV_WORKSPACE_ID],
          ]);
        }
        await client.signedIn(
          { accessToken: DEV_ACCESS_TOKEN, refreshToken: DEV_REFRESH_TOKEN },
          true
        );
      } catch {
        // Fallback to dev user
        setUser(DEV_USER);
        setWorkspaceIdState(DEV_WORKSPACE_ID);
      } finally {
        setIsLoading(false);
      }
    }
    loadStoredAuth();
  }, [client]);

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
