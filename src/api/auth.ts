import type { ApiClient } from './client';

import type { components, operations } from './types';

// Shapes come from the backend's openapi.json (backend QUESTIONS Q-B2); run `npm run api:sync` when it changes.
type Schemas = components['schemas'];
type Body<K extends keyof operations> = operations[K] extends { requestBody?: { content: { 'application/json': infer B } } } ? B : never;

export type User = Schemas['User'];
export type Workspace = Schemas['Workspace'];
export type PublicConfig = Schemas['PublicConfig'];
export type SessionResponse = Schemas['SessionResponse'];
/** Sign-in answers a session, or a two-factor challenge when two-factor is on. */
export type SignInResponse = Schemas['SignInResponse'];
export type CodeSent = Schemas['CodeSent'];
export type InstitutionList = Schemas['InstitutionList'];

export type SignInBody = Body<'signIn'>;
export type SignUpBody = Body<'signUp'>;
export type VerifyEmailBody = Body<'verifyEmail'>;
export type ResendCodeBody = Body<'resendCode'>;
export type RecoverBody = Body<'recover'>;
export type NewPasswordBody = Body<'newPassword'>;
/** Opening balances and take-home are strings of kobo. */
export type SetupBody = Body<'finishSetup'>;

export function authApi(client: ApiClient) {
  return {
    signIn: (body: SignInBody) => client.request<SignInResponse>('POST', '/v1/auth/sign-in', body, { auth: false }),
    signUp: (body: SignUpBody) => client.request<CodeSent>('POST', '/v1/auth/sign-up', body, { auth: false }),
    verifyEmail: (body: VerifyEmailBody) =>
      client.request<SessionResponse>('POST', '/v1/auth/verify-email', body, { auth: false }),
    resendCode: (body: ResendCodeBody) => client.request<CodeSent>('POST', '/v1/auth/resend-code', body, { auth: false }),
    recover: (body: RecoverBody) => client.request<CodeSent>('POST', '/v1/auth/recover', body, { auth: false }),
    newPassword: (body: NewPasswordBody) =>
      client.request<null>('POST', '/v1/auth/new-password', body, { auth: false }),
    signOut: () => client.request<null>('POST', '/v1/auth/sign-out'),
    signOutOthers: () => client.request<null>('POST', '/v1/auth/sign-out-others'),
    workspace: (workspaceId: string) => client.request<Workspace>('GET', `/v1/workspaces/${workspaceId}`),
    publicConfig: () => client.request<PublicConfig>('GET', '/v1/public-config', undefined, { auth: false }),
    me: () => client.request<User>('GET', '/v1/me'),
    finishSetup: (workspaceId: string, body: SetupBody) =>
      client.request<User>('POST', `/v1/workspaces/${workspaceId}/setup`, body),
    /** Welcome step 3 logos (TECH-SPEC institutions; public + cacheable). */
    listInstitutions: () =>
      client.request<InstitutionList>('GET', '/v1/institutions', undefined, { auth: false }),
  };
}

export type AuthApi = ReturnType<typeof authApi>;
