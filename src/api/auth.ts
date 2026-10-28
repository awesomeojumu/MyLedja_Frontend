import type { ApiClient, Tokens } from './client';

// Provisional shapes until the backend publishes openapi.json (see docs/QUESTIONS.md Q-3).
export type User = { id: string; name: string; email: string; setupComplete: boolean; workspaceId: string; workspaceName: string };
export type SessionResponse = Tokens & { user: User };

export type SignInBody = { email: string; password: string; staySignedIn: boolean };
export type SignUpBody = { name: string; email: string; password: string; termsAccepted: true };
export type VerifyEmailBody = { email: string; code: string };
export type RecoverBody = { email: string };
export type NewPasswordBody = { email: string; code: string; newPassword: string };
export type SetupBody = {
  workspaceName: string;
  currency: 'NGN';
  weekStart: 'monday' | 'sunday' | 'saturday';
  accounts: { name: string; type: string; openingBalance: string; openingDate: string }[];
  categories: { key: string; group: string; name: string }[];
  budgetStyle: 'tracking' | 'envelope';
  monthlyTakeHome: string | null;
  /** Steps left for the Dashboard's "Get started" checklist (P04-02). */
  skippedSteps: number[];
};

export function authApi(client: ApiClient) {
  return {
    signIn: (body: SignInBody) => client.request<SessionResponse>('POST', '/v1/auth/sign-in', body, { auth: false }),
    signUp: (body: SignUpBody) => client.request<null>('POST', '/v1/auth/sign-up', body, { auth: false }),
    verifyEmail: (body: VerifyEmailBody) =>
      client.request<SessionResponse>('POST', '/v1/auth/verify-email', body, { auth: false }),
    resendCode: (body: RecoverBody) => client.request<null>('POST', '/v1/auth/resend-code', body, { auth: false }),
    recover: (body: RecoverBody) => client.request<null>('POST', '/v1/auth/recover', body, { auth: false }),
    newPassword: (body: NewPasswordBody) =>
      client.request<null>('POST', '/v1/auth/new-password', body, { auth: false }),
    signOut: () => client.request<null>('POST', '/v1/auth/sign-out'),
    me: () => client.request<User>('GET', '/v1/me'),
    finishSetup: (workspaceId: string, body: SetupBody) =>
      client.request<User>('POST', `/v1/workspaces/${workspaceId}/setup`, body),
  };
}

export type AuthApi = ReturnType<typeof authApi>;
