import type { Transport, TransportRequest, TransportResponse } from '../client';
import type { User } from '../auth';
import en from '@/i18n/en.json';

import { createSecurityMock } from './security';

/** Demo person from build plan 2.7. Works only with the mock adapter. */
export const DEMO = { name: 'Ada', email: 'ada@example.test', password: 'demo-password-1', code: '123456' };

type MockUser = User & { password: string; twoFactor?: boolean; emailVerified?: boolean };

export function createAuthMock() {
  const users = new Map<string, MockUser>();
  const pendingCodes = new Map<string, string>();
  const failures = new Map<string, number>();
  const operations = new Map<string, TransportResponse>();
  const security = createSecurityMock();
  let counter = 0;

  users.set(DEMO.email, {
    id: 'user-ada',
    name: DEMO.name,
    email: DEMO.email,
    password: DEMO.password,
    setupComplete: true,
    workspaceId: 'ws-personal',
    workspaceName: 'Personal',
  });

  /** Matches openapi.json: with "Stay signed in" on web the refresh token is a cookie, so the body has null. */
  const session = (u: MockUser, cookie = false): TransportResponse => {
    counter++;
    const { password: _password, ...user } = u;
    return { status: 200, body: { accessToken: `access-${counter}`, accessTokenExpiresIn: 900, refreshToken: cookie ? null : `refresh-${counter}`, user } };
  };
  const codeSent: TransportResponse = { status: 202, body: { codeExpiresInSeconds: 600, resendAfterSeconds: 45 } };
  const noContent: TransportResponse = { status: 204, body: null };
  const error = (status: number, code: string, message: string, field?: string, extra?: object) => ({
    status,
    body: { code, message, field, ...extra },
  });
  const ok = (body: unknown = null): TransportResponse => ({ status: 200, body });

  const handle = (req: TransportRequest): TransportResponse => {
    const b = (req.body ?? {}) as Record<string, string>;
    const stay = (req.body as { staySignedIn?: boolean } | undefined)?.staySignedIn === true;
    switch (`${req.method} ${req.path}`) {
      case 'POST /v1/auth/sign-in': {
        const tries = failures.get(b.email!) ?? 0;
        if (tries >= 5) return error(429, 'too_many_attempts', en['signIn.wait'], undefined, { retryAfterSeconds: 60 });
        const u = users.get(b.email!);
        if (!u || u.password !== b.password) {
          failures.set(b.email!, tries + 1);
          if (tries + 1 >= 5) return error(429, 'too_many_attempts', en['signIn.wait'], undefined, { retryAfterSeconds: 60 });
          return error(401, 'credentials_wrong', en['signIn.wrong']);
        }
        failures.delete(b.email!);
        if (u.emailVerified === false) {
          return error(403, 'email_not_verified', en['signIn.emailNotVerified']);
        }
        if (u.twoFactor) {
          return ok({ twoFactorRequired: true, challengeToken: `challenge-${u.id}` });
        }
        return session(u, stay);
      }
      case 'POST /v1/auth/sign-up':
        // Same answer whether or not the email is known (P02-04).
        if (!users.has(b.email!)) {
          pendingCodes.set(b.email!, DEMO.code);
          users.set(b.email!, {
            id: `user-${users.size + 1}`,
            name: b.name!,
            email: b.email!,
            password: b.password!,
            setupComplete: false,
            workspaceId: `ws-${users.size + 1}`,
            workspaceName: 'Personal',
          });
        }
        return codeSent;
      case 'POST /v1/auth/resend-code':
        return codeSent;
      case 'POST /v1/auth/verify-email': {
        const u = users.get(b.email!);
        if (!u || pendingCodes.get(b.email!) !== b.code) return error(400, 'code_invalid', en['errors.codeInvalid'], 'code');
        pendingCodes.delete(b.email!);
        return session(u, stay);
      }
      case 'POST /v1/auth/recover':
        if (users.has(b.email!)) pendingCodes.set(`recover:${b.email}`, DEMO.code);
        return codeSent;
      case 'POST /v1/auth/new-password': {
        const u = users.get(b.email!);
        if (!u || pendingCodes.get(`recover:${b.email}`) !== b.code)
          return error(400, 'code_invalid', en['errors.codeInvalid'], 'code');
        u.password = b.newPassword!;
        pendingCodes.delete(`recover:${b.email}`);
        return noContent;
      }
      case 'POST /v1/auth/refresh':
        if (b.refreshToken) return ok({ accessToken: `access-${++counter}`, accessTokenExpiresIn: 900, refreshToken: `refresh-${counter}` });
        if (req.withCredentials) return ok({ accessToken: `access-${++counter}`, accessTokenExpiresIn: 900, refreshToken: null });
        return error(401, 'signed_out', '');
      case 'POST /v1/auth/sign-out':
      case 'POST /v1/auth/sign-out-others':
        return noContent;
      case 'POST /v1/auth/google': {
        const idToken = b.idToken?.trim();
        if (!idToken) return error(400, 'validation_failed', 'idToken is required', 'idToken');
        // Mock: token "link:<email>" forces google_link_needed; any other non-empty token creates/signs in.
        if (idToken.startsWith('link:')) {
          const email = idToken.slice('link:'.length);
          return error(409, 'google_link_needed', 'Sign in with your password to link Google', undefined, {
            email,
            linkToken: `link-token-${email}`,
          });
        }
        const email = idToken.startsWith('email:') ? idToken.slice('email:'.length) : `google-${idToken.slice(0, 12)}@example.test`;
        let u = users.get(email);
        if (!u) {
          u = {
            id: `user-google-${users.size + 1}`,
            name: 'Google User',
            email,
            password: '',
            setupComplete: false,
            workspaceId: `ws-google-${users.size + 1}`,
            workspaceName: 'Personal',
          };
          users.set(email, u);
        } else if (u.password) {
          return error(409, 'google_link_needed', 'Sign in with your password to link Google', undefined, {
            email: u.email,
            linkToken: `link-token-${u.email}`,
          });
        }
        return session(u, stay);
      }
      case 'GET /v1/public-config':
        return ok({ env: 'development', google: { enabled: false, clientId: null }, services: { bankConnections: false, files: false, ai: false } });
      default: {
        const fromSecurity = security(req);
        if (fromSecurity) return fromSecurity;
        const setup = req.path.match(/^\/v1\/workspaces\/([^/]+)\/setup$/);
        if (req.method === 'POST' && setup) {
          const u = [...users.values()].find((x) => x.workspaceId === setup[1]);
          if (!u) return error(404, 'not_found', '');
          u.setupComplete = true;
          u.workspaceName = b.workspaceName ?? u.workspaceName;
          const { password: _password, ...user } = u;
          return ok(user);
        }
        return error(404, 'not_found', '');
      }
    }
  };

  const transport: Transport = async (req) => {
    const opId = req.headers['X-Operation-Id'];
    if (opId && operations.has(opId)) return operations.get(opId)!;
    const res = handle(req);
    if (opId) operations.set(opId, res);
    return res;
  };

  return { transport, users, failures };
}
