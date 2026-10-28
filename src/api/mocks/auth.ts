import type { Transport, TransportRequest, TransportResponse } from '../client';
import type { User } from '../auth';
import en from '@/i18n/en.json';

/** Demo person from build plan 2.7. Works only with the mock adapter. */
export const DEMO = { name: 'Ada', email: 'ada@example.test', password: 'demo-password-1', code: '123456' };

type MockUser = User & { password: string };

export function createAuthMock() {
  const users = new Map<string, MockUser>();
  const pendingCodes = new Map<string, string>();
  const failures = new Map<string, number>();
  const operations = new Map<string, TransportResponse>();
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

  const session = (u: MockUser): TransportResponse => {
    counter++;
    const { password: _password, ...user } = u;
    return { status: 200, body: { accessToken: `access-${counter}`, refreshToken: `refresh-${counter}`, user } };
  };
  const error = (status: number, code: string, message: string, field?: string, extra?: object) => ({
    status,
    body: { code, message, field, ...extra },
  });
  const ok = (body: unknown = null): TransportResponse => ({ status: 200, body });

  const handle = (req: TransportRequest): TransportResponse => {
    const b = (req.body ?? {}) as Record<string, string>;
    switch (`${req.method} ${req.path}`) {
      case 'POST /v1/auth/sign-in': {
        const tries = failures.get(b.email!) ?? 0;
        if (tries >= 5) return error(429, 'too_many_attempts', en['signIn.wait'], undefined, { retryAfterSeconds: 60 });
        const u = users.get(b.email!);
        if (!u || u.password !== b.password) {
          failures.set(b.email!, tries + 1);
          return error(401, 'credentials_wrong', en['signIn.wrong']);
        }
        failures.delete(b.email!);
        return session(u);
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
        return { status: 202, body: null };
      case 'POST /v1/auth/resend-code':
        return { status: 202, body: null };
      case 'POST /v1/auth/verify-email': {
        const u = users.get(b.email!);
        if (!u || pendingCodes.get(b.email!) !== b.code) return error(400, 'code_invalid', en['errors.codeInvalid'], 'code');
        pendingCodes.delete(b.email!);
        return session(u);
      }
      case 'POST /v1/auth/recover':
        if (users.has(b.email!)) pendingCodes.set(`recover:${b.email}`, DEMO.code);
        return { status: 202, body: null };
      case 'POST /v1/auth/new-password': {
        const u = users.get(b.email!);
        if (!u || pendingCodes.get(`recover:${b.email}`) !== b.code)
          return error(400, 'code_invalid', en['errors.codeInvalid'], 'code');
        u.password = b.newPassword!;
        pendingCodes.delete(`recover:${b.email}`);
        return ok();
      }
      case 'POST /v1/auth/refresh':
        return b.refreshToken || req.withCredentials ? ok({ accessToken: `access-${++counter}`, refreshToken: `refresh-${counter}` }) : error(401, 'signed_out', '');
      case 'POST /v1/auth/sign-out':
        return ok();
      default: {
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
