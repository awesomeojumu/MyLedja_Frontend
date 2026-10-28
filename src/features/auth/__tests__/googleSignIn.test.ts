import { authApi } from '@/api/auth';
import { ApiClient, type Transport } from '@/api/client';
import { createAuthMock } from '@/api/mocks/auth';
import { createMemorySessionStore } from '@/data/session';
import {
  googleClientId,
  googleSignInEnabled,
  loadGoogleSignIn,
  resetGoogleSignInCache,
  runGoogleSignIn,
} from '../googleSignIn';

function apiWithPublicConfig(google: { enabled: boolean; clientId: string | null }) {
  const mock = createAuthMock();
  const base = mock.transport;
  const transport: Transport = async (req) => {
    if (req.method === 'GET' && req.path === '/v1/public-config') {
      return {
        status: 200,
        body: {
          env: 'development',
          google,
          services: { bankConnections: false, files: false, ai: false },
        },
      };
    }
    return base(req);
  };
  return authApi(new ApiClient(transport, createMemorySessionStore()));
}

beforeEach(() => {
  resetGoogleSignInCache();
});

describe('googleSignIn (public-config)', () => {
  it('stays off until public-config enables Google with a client id', async () => {
    expect(googleSignInEnabled()).toBe(false);
    const off = await loadGoogleSignIn(apiWithPublicConfig({ enabled: false, clientId: null }));
    expect(off).toEqual({ enabled: false, clientId: null });
    expect(googleSignInEnabled()).toBe(false);

    resetGoogleSignInCache();
    const emptyId = await loadGoogleSignIn(apiWithPublicConfig({ enabled: true, clientId: '  ' }));
    expect(emptyId.enabled).toBe(false);

    resetGoogleSignInCache();
    const on = await loadGoogleSignIn(
      apiWithPublicConfig({ enabled: true, clientId: 'test.apps.googleusercontent.com' }),
    );
    expect(on).toEqual({ enabled: true, clientId: 'test.apps.googleusercontent.com' });
    expect(googleSignInEnabled()).toBe(true);
    expect(googleClientId()).toBe('test.apps.googleusercontent.com');
  });

  it('hides the flow when the API is unreachable', async () => {
    const transport: Transport = async () => {
      throw new Error('offline');
    };
    const api = authApi(new ApiClient(transport, createMemorySessionStore()));
    await expect(loadGoogleSignIn(api)).resolves.toEqual({ enabled: false, clientId: null });
    await expect(runGoogleSignIn(api)).resolves.toEqual({ ok: false, reason: 'unavailable' });
  });

  it('caches public-config so the button does not refetch every render', async () => {
    let hits = 0;
    const mock = createAuthMock();
    const transport: Transport = async (req) => {
      if (req.method === 'GET' && req.path === '/v1/public-config') {
        hits += 1;
        return {
          status: 200,
          body: {
            env: 'development',
            google: { enabled: true, clientId: 'cached.apps.googleusercontent.com' },
            services: { bankConnections: false, files: false, ai: false },
          },
        };
      }
      return mock.transport(req);
    };
    const api = authApi(new ApiClient(transport, createMemorySessionStore()));
    await loadGoogleSignIn(api);
    await loadGoogleSignIn(api);
    expect(hits).toBe(1);
  });
});
