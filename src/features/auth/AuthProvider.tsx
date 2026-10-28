import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiClient, fetchTransport, type Transport } from '@/api/client';
import { authApi, type AuthApi, type SessionResponse, type User } from '@/api/auth';
import { createAuthMock } from '@/api/mocks/auth';
import { config } from '@/config';
import { createSessionStore, type SessionStore } from '@/data/session';

export type ApiSource = 'mock' | 'local' | 'staging';
const LOCAL_API = 'http://localhost:4000';

type AuthState = {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: User | null;
  api: AuthApi;
  client: ApiClient;
  source: ApiSource;
  setSource: (s: ApiSource) => void;
  completeSignIn: (res: SessionResponse, staySignedIn: boolean) => Promise<void>;
  setUser: (u: User) => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

function transportFor(source: ApiSource, mock: Transport): Transport {
  if (source === 'mock') return mock;
  if (source === 'local') return fetchTransport(LOCAL_API);
  return fetchTransport(config.apiUrl ?? LOCAL_API);
}

export function AuthProvider({
  children,
  initialSource = config.appEnv === 'development' ? 'mock' : 'staging',
  session,
  transport,
}: {
  children: ReactNode;
  initialSource?: ApiSource;
  session?: SessionStore;
  transport?: Transport;
}) {
  const [{ mock, client }] = useState(() => {
    const mockTransport = createAuthMock().transport;
    return {
      mock: mockTransport,
      client: new ApiClient(transport ?? transportFor(initialSource, mockTransport), session ?? createSessionStore()),
    };
  });
  const api = useMemo(() => authApi(client), [client]);
  const [source, setSourceState] = useState<ApiSource>(initialSource);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (await client.refresh()) {
          const me = await api.me();
          if (alive) {
            setUser(me);
            setStatus('signed-in');
          }
          return;
        }
      } catch {
        // Fall through to signed out; the sign-in page explains what's needed.
      }
      if (alive) setStatus('signed-out');
    })();
    return () => {
      alive = false;
    };
  }, [client, api]);

  const setSource = useCallback(
    (s: ApiSource) => {
      setSourceState(s);
      client.setTransport(transportFor(s, mock));
    },
    [client, mock],
  );

  const completeSignIn = useCallback(
    async (res: SessionResponse, staySignedIn: boolean) => {
      await client.signedIn(res, staySignedIn);
      setUser(res.user);
      setStatus('signed-in');
    },
    [client],
  );

  const signOut = useCallback(async () => {
    try {
      await api.signOut();
    } catch {
      // Signing out locally must still happen when the server can't be reached.
    }
    await client.signOut();
    setUser(null);
    setStatus('signed-out');
  }, [api, client]);

  const value = useMemo(
    () => ({ status, user, api, client, source, setSource, completeSignIn, setUser, signOut }),
    [status, user, api, client, source, setSource, completeSignIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider missing');
  return v;
}
