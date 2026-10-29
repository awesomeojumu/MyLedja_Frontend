import { authApi } from '@/api/auth';
import { ApiClient, type Transport } from '@/api/client';
import { createAuthMock } from '@/api/mocks/auth';
import { createMemorySessionStore } from '@/data/session';
import { obtainGoogleIdToken } from '../googleIdToken';
import {
  googleClientId,
  googleSignInEnabled,
  loadGoogleSignIn,
  peekGoogleLinkPending,
  resetGoogleSignInCache,
  runGoogleSignIn,
} from '../googleSignIn';

jest.mock('../googleIdToken', () => ({
  obtainGoogleIdToken: jest.fn(),
}));

const obtain = obtainGoogleIdToken as jest.MockedFunction<typeof obtainGoogleIdToken>;

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
  obtain.mockReset();
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

  it('POSTs the ID token to /v1/auth/google and returns a session (P02-05 / T0.2)', async () => {
    obtain.mockResolvedValue({ ok: true, idToken: 'email:new.google@example.test' });
    const api = apiWithPublicConfig({ enabled: true, clientId: 'test.apps.googleusercontent.com' });
    const res = await runGoogleSignIn(api);
    expect(res.ok).toBe(true);
    if (res.ok && 'user' in res.session) {
      expect(res.session.user.email).toBe('new.google@example.test');
      expect(res.session.user.setupComplete).toBe(false);
    } else {
      throw new Error('expected a session with user');
    }
  });

  it('maps 409 google_link_needed to link_password and stores the pending token', async () => {
    obtain.mockResolvedValue({ ok: true, idToken: 'link:ada@example.test' });
    const api = apiWithPublicConfig({ enabled: true, clientId: 'test.apps.googleusercontent.com' });
    const res = await runGoogleSignIn(api);
    expect(res).toMatchObject({ ok: false, reason: 'link_password', email: 'ada@example.test' });
    expect(peekGoogleLinkPending()).toEqual({ email: 'ada@example.test', linkToken: 'link-token-ada@example.test' });
  });

  it('returns cancelled when the user dismisses Google', async () => {
    obtain.mockResolvedValue({ ok: false, reason: 'cancelled' });
    const api = apiWithPublicConfig({ enabled: true, clientId: 'test.apps.googleusercontent.com' });
    await expect(runGoogleSignIn(api)).resolves.toEqual({ ok: false, reason: 'cancelled' });
  });
});
