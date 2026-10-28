import spec from '../openapi.json';
import { authApi, type CodeSent, type PublicConfig, type SessionResponse } from '../auth';
import { ApiClient } from '../client';
import { createAuthMock, DEMO } from '../mocks/auth';
import { createMemorySessionStore } from '@/data/session';

type Schema = { type?: string | string[]; required?: string[]; properties?: Record<string, Schema>; $ref?: string; const?: unknown };
const schemas = (spec as unknown as { components: { schemas: Record<string, Schema> } }).components.schemas;

/** Checks required keys and simple types, so the mock can't drift from openapi.json. */
function conforms(value: unknown, schema: Schema, path = '$'): string[] {
  if (schema.$ref) return conforms(value, schemas[schema.$ref.split('/').pop()!]!, path);
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const actual = value === null ? 'null' : Number.isInteger(value) ? 'integer' : typeof value;
  if (types.length && !types.some((t) => t === actual || (t === 'number' && actual === 'integer'))) return [`${path}: ${actual} is not ${types.join('|')}`];
  if (schema.const !== undefined && value !== schema.const) return [`${path}: not ${String(schema.const)}`];
  if (actual !== 'object') return [];
  const obj = value as Record<string, unknown>;
  const problems = (schema.required ?? []).filter((k) => !(k in obj)).map((k) => `${path}.${k} missing`);
  for (const [k, sub] of Object.entries(schema.properties ?? {})) if (k in obj && obj[k] !== undefined) problems.push(...conforms(obj[k], sub, `${path}.${k}`));
  return problems;
}

function setup() {
  const mock = createAuthMock();
  const client = new ApiClient(mock.transport, createMemorySessionStore(), async () => {});
  return { mock, api: authApi(client), client };
}

describe('the auth mock follows openapi.json', () => {
  it('sessions carry accessTokenExpiresIn; a web cookie session has a null refresh token', async () => {
    const { api } = setup();
    const kept: SessionResponse = await api.signIn({ email: DEMO.email, password: DEMO.password, staySignedIn: true });
    expect(conforms(kept, schemas.SessionResponse!)).toEqual([]);
    expect(kept.refreshToken).toBeNull();
    const plain = await api.signIn({ email: DEMO.email, password: DEMO.password, staySignedIn: false });
    expect(typeof plain.refreshToken).toBe('string');
  });

  it('sign-up, resend and recover answer with CodeSent', async () => {
    const { api } = setup();
    const answers: CodeSent[] = [
      await api.signUp({ name: 'Tunde', email: 'tunde@example.test', password: 'a-long-password-1', termsAccepted: true }),
      await api.resendCode({ email: 'tunde@example.test', purpose: 'sign_up' }),
      await api.recover({ email: 'nobody@example.test' }),
    ];
    for (const a of answers) expect(conforms(a, schemas.CodeSent!)).toEqual([]);
  });

  it('public config and the user from setup match their schemas', async () => {
    const { api } = setup();
    const config: PublicConfig = await api.publicConfig();
    expect(conforms(config, schemas.PublicConfig!)).toEqual([]);
    await api.signIn({ email: DEMO.email, password: DEMO.password });
    const user = await api.finishSetup('ws-personal', {
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '81230000', openingDate: '2026-10-01' }],
      categories: [],
      budgetStyle: 'tracking',
      monthlyTakeHome: null,
      skippedSteps: [],
    });
    expect(conforms(user, schemas.User!)).toEqual([]);
  });

  it('wrong details give the contract error shape', async () => {
    const { api } = setup();
    await expect(api.signIn({ email: DEMO.email, password: 'nope-nope-1' })).rejects.toMatchObject({ status: 401, body: { code: 'credentials_wrong' } });
  });
});
