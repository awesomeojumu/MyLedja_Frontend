import type { ApiClient } from './client';

import type { components } from './types';

type Schemas = components['schemas'];

export type AiSettings = Schemas['AiSettings'];
export type StatementImport = Schemas['StatementImport'];
export type BankLink = Schemas['BankLink'];
export type AiConsent = { categorize: boolean; statements: boolean; healthAdvice: boolean };

/** Settings › AI features, statement reading and bank connections (build plan F4.1, F4.3). */
export function aiApi(client: ApiClient) {
  return {
    settings: (workspaceId: string) => client.request<AiSettings>('GET', `/v1/workspaces/${workspaceId}/ai`),
    setConsent: (workspaceId: string, consent: AiConsent) =>
      client.request<AiSettings>('PUT', `/v1/workspaces/${workspaceId}/ai/consent`, consent),
    uploadStatement: (workspaceId: string, body: { accountId: string; fileName: string; fileBase64: string; useAi: boolean }) =>
      client.request<StatementImport>('POST', `/v1/workspaces/${workspaceId}/imports/statement`, body),
    bankLinks: (workspaceId: string) => client.request<{ links: BankLink[]; available: boolean }>('GET', `/v1/workspaces/${workspaceId}/banking/links`),
    linkBank: (workspaceId: string, body: { accountId: string; code: string }) =>
      client.request<BankLink>('POST', `/v1/workspaces/${workspaceId}/banking/mono/link`, body),
    syncBank: (workspaceId: string, linkId: string) =>
      client.request<{ import: StatementImport | null; newTransactions: number }>('POST', `/v1/workspaces/${workspaceId}/banking/links/${linkId}/sync`),
    disconnectBank: (workspaceId: string, linkId: string) => client.request<null>('DELETE', `/v1/workspaces/${workspaceId}/banking/links/${linkId}`),
  };
}

export type AiApi = ReturnType<typeof aiApi>;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Bytes to base64 without Node's Buffer, which phones don't have. */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2]! + B64[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    out += c === undefined ? '=' : B64[c & 63]!;
  }
  return out;
}
