import type { ApiClient } from './client';

import type { components } from './types';

type Schemas = components['schemas'];

export type SecurityStatus = Schemas['SecurityStatus'];
export type TwoFactorSetup = Schemas['TwoFactorSetup'];
export type PasskeyOptions = Schemas['PasskeyOptions'];
export type Passkey = Schemas['Passkey'];
export type DeviceSession = Schemas['DeviceSession'];
export type ActivityEvent = Schemas['ActivityEvent'];
export type ExportFile = Schemas['ExportFile'];
export type RestorePreview = Schemas['RestorePreview'];
export type Restored = Schemas['Restored'];
export type TwoFactorRequired = Schemas['TwoFactorRequired'];
export type TwoFactorSessionResponse = Schemas['TwoFactorSessionResponse'];
export type SessionResponse = Schemas['SessionResponse'];

/** Settings › Security, Workspace activity, and Import and export (build plan F3.1 to F3.4). */
export function securityApi(client: ApiClient) {
  return {
    twoFactorSignIn: (body: { challengeToken: string; code?: string; backupCode?: string; trustDevice: boolean; staySignedIn: boolean; deviceName?: string }) =>
      client.request<TwoFactorSessionResponse>('POST', '/v1/auth/two-factor', body, { auth: false }),
    passkeySignInOptions: () => client.request<PasskeyOptions>('POST', '/v1/auth/passkey/options', undefined, { auth: false }),
    passkeySignIn: (body: { challengeToken: string; response: Record<string, unknown>; staySignedIn: boolean; deviceName?: string }) =>
      client.request<SessionResponse>('POST', '/v1/auth/passkey', body, { auth: false }),
    recheck: (body: { password?: string; challengeToken?: string; response?: Record<string, unknown> }) =>
      client.request<SecurityStatus>('POST', '/v1/auth/recheck', body),
    recheckPasskeyOptions: () => client.request<PasskeyOptions>('POST', '/v1/auth/recheck/passkey-options'),
    status: () => client.request<SecurityStatus>('GET', '/v1/me/security'),
    twoFactorSetup: () => client.request<TwoFactorSetup>('POST', '/v1/me/two-factor/setup'),
    twoFactorConfirm: (code: string) => client.request<{ backupCodes: string[] }>('POST', '/v1/me/two-factor/confirm', { code }),
    newBackupCodes: () => client.request<{ backupCodes: string[] }>('POST', '/v1/me/two-factor/backup-codes'),
    twoFactorOff: () => client.request<null>('DELETE', '/v1/me/two-factor'),
    passkeyAddOptions: () => client.request<PasskeyOptions>('POST', '/v1/me/passkeys/options'),
    passkeyAdd: (body: { challengeToken: string; response: Record<string, unknown>; name: string }) =>
      client.request<Passkey>('POST', '/v1/me/passkeys', body),
    passkeyRemove: (id: string) => client.request<null>('DELETE', `/v1/me/passkeys/${encodeURIComponent(id)}`),
    sessions: () => client.request<{ sessions: DeviceSession[] }>('GET', '/v1/me/sessions'),
    signOutSession: (id: string) => client.request<null>('DELETE', `/v1/me/sessions/${id}`),
    signOutOthers: () => client.request<{ signedOut: number }>('POST', '/v1/auth/sign-out-others'),
    changePassword: (body: { currentPassword: string; newPassword: string }) => client.request<null>('POST', '/v1/me/password', body),
    activity: (workspaceId: string, q: { before?: string; action?: string } = {}) => {
      const params = new URLSearchParams({ limit: '50', ...(q.before ? { before: q.before } : {}), ...(q.action ? { action: q.action } : {}) });
      return client.request<{ events: ActivityEvent[]; nextBefore: string | null }>('GET', `/v1/workspaces/${workspaceId}/activity?${params.toString()}`);
    },
    exportCsv: (workspaceId: string) => client.request<ExportFile>('POST', `/v1/workspaces/${workspaceId}/exports/transactions`),
    backup: (workspaceId: string) => client.request<ExportFile>('POST', `/v1/workspaces/${workspaceId}/backups`),
    restorePreview: (content: string) => client.request<RestorePreview>('POST', '/v1/me/restore/preview', { content }),
    restore: (content: string) => client.request<Restored>('POST', '/v1/me/restore', { content }),
    deleteAccount: () => client.request<{ deletingWorkspaces: number }>('POST', '/v1/me/delete'),
  };
}

export type SecurityApi = ReturnType<typeof securityApi>;

export const isTwoFactorRequired = (body: unknown): body is TwoFactorRequired =>
  !!body && typeof body === 'object' && (body as { twoFactorRequired?: unknown }).twoFactorRequired === true;
