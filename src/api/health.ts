import type { ApiClient } from './client';
import type { components } from './types';

type Schemas = components['schemas'];

export type ServerHealthPage = Schemas['HealthPage'];
export type ServerHealthSettings = Schemas['HealthSettings'];

/** Financial health (DESIGN.md page 23 / TECH-SPEC 6.10). */
export function healthApi(client: ApiClient) {
  return {
    page: (workspaceId: string, month: string) =>
      client.request<ServerHealthPage>('GET', `/v1/workspaces/${workspaceId}/health/${month}`),
    setSettings: (workspaceId: string, body: ServerHealthSettings) =>
      client.request<ServerHealthSettings>('PUT', `/v1/workspaces/${workspaceId}/health-settings`, body),
  };
}

export type HealthApi = ReturnType<typeof healthApi>;
