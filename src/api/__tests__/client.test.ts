import { ApiClient, ApiError, CSRF_HEADER, NetworkError, OPERATION_HEADER, type Transport, type TransportRequest } from '../client';
import { createMemorySessionStore } from '@/data/session';

const noSleep = async () => {};

function recorder(responder: (req: TransportRequest, n: number) => { status: number; body: unknown }) {
  const calls: TransportRequest[] = [];
  const transport: Transport = async (req) => {
    calls.push(req);
    return responder(req, calls.length);
  };
  return { calls, transport };
}

describe('ApiClient (F0.7)', () => {
  it('a write sends an operationId; a read does not', async () => {
    const { calls, transport } = recorder(() => ({ status: 200, body: {} }));
    const client = new ApiClient(transport, createMemorySessionStore(), noSleep);
    await client.request('POST', '/v1/things', { a: 1 });
    await client.request('GET', '/v1/things');
    expect(calls[0]!.headers[OPERATION_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls[1]!.headers[OPERATION_HEADER]).toBeUndefined();
  });

  it('retries keep the same operationId', async () => {
    const { calls, transport } = recorder((_r, n) => (n === 1 ? { status: 503, body: null } : { status: 200, body: {} }));
    const client = new ApiClient(transport, createMemorySessionStore(), noSleep);
    await client.request('POST', '/v1/things', {});
    expect(calls).toHaveLength(2);
    expect(calls[0]!.headers[OPERATION_HEADER]).toBe(calls[1]!.headers[OPERATION_HEADER]);
  });

  it('a 401 triggers one refresh, then the request is sent again', async () => {
    const session = createMemorySessionStore();
    await session.setRefreshToken('r1');
    const { calls, transport } = recorder((req, n) => {
      if (req.path === '/v1/auth/refresh') return { status: 200, body: { accessToken: 'a2', refreshToken: 'r2' } };
      return n === 1 ? { status: 401, body: { code: 'expired', message: '' } } : { status: 200, body: { ok: true } };
    });
    const client = new ApiClient(transport, session, noSleep);
    await expect(client.request('GET', '/v1/me')).resolves.toEqual({ ok: true });
    expect(calls.map((c) => c.path)).toEqual(['/v1/me', '/v1/auth/refresh', '/v1/me']);
    expect(calls[2]!.headers.Authorization).toBe('Bearer a2');
    expect(calls[1]!.headers[CSRF_HEADER]).toBe('1');
    expect(await session.getRefreshToken()).toBe('r2');
  });

  it('a failed refresh signs out and clears the stored token', async () => {
    const session = createMemorySessionStore();
    await session.setRefreshToken('old');
    const { calls, transport } = recorder((req) =>
      req.path === '/v1/auth/refresh' ? { status: 401, body: {} } : { status: 401, body: { code: 'expired', message: '' } },
    );
    const client = new ApiClient(transport, session, noSleep);
    await expect(client.request('GET', '/v1/me')).rejects.toBeInstanceOf(ApiError);
    expect(calls.filter((c) => c.path === '/v1/auth/refresh')).toHaveLength(1);
    expect(await session.getRefreshToken()).toBeNull();
  });

  it('gives up on the network after its retries', async () => {
    const transport: Transport = async () => {
      throw new NetworkError();
    };
    const client = new ApiClient(transport, createMemorySessionStore(), noSleep);
    await expect(client.request('GET', '/v1/me')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('session storage (F0.8)', () => {
  it('sign-out clears every stored token', async () => {
    const flags = new Map<string, string>();
    const storage = { getItem: (k: string) => flags.get(k) ?? null, setItem: (k: string, v: string) => void flags.set(k, v), removeItem: (k: string) => void flags.delete(k) };
    const session = createMemorySessionStore(storage);
    const client = new ApiClient(async () => ({ status: 200, body: null }), session, noSleep);
    await client.signedIn({ accessToken: 'a', refreshToken: 'r' }, true);
    expect(await session.hasCookieSession()).toBe(true);
    await client.signOut();
    expect(client.hasAccessToken()).toBe(false);
    expect(await session.getRefreshToken()).toBeNull();
    expect(await session.hasCookieSession()).toBe(false);
    expect(flags.size).toBe(0);
  });

  it('phones keep the refresh token in the secure store and delete it on sign-out', async () => {
    const { createSecureSessionStore } = jest.requireActual('@/data/session.native') as typeof import('@/data/session.native');
    const store = new Map<string, string>();
    const secure = {
      getItemAsync: async (k: string) => store.get(k) ?? null,
      setItemAsync: async (k: string, v: string) => void store.set(k, v),
      deleteItemAsync: async (k: string) => void store.delete(k),
    };
    const session = createSecureSessionStore(secure);
    await session.setRefreshToken('r');
    expect(await session.getRefreshToken()).toBe('r');
    await session.clear();
    expect(store.size).toBe(0);
  });
});
