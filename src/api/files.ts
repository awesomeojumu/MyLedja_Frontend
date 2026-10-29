import type { ApiClient } from './client';

export type UploadedFile = { id: string; url?: string };
export type FileViewUrl = { url: string; expiresAt?: string };

/** Receipt / attachment files (hand-written until openapi sync covers /files). */
export function filesApi(client: ApiClient) {
  return {
    uploadFile: (workspaceId: string, body: { fileName: string; contentBase64: string; contentType?: string }) =>
      client.request<UploadedFile>('POST', `/v1/workspaces/${workspaceId}/files`, body),
    viewUrl: (workspaceId: string, fileId: string) =>
      client.request<FileViewUrl>('GET', `/v1/workspaces/${workspaceId}/files/${encodeURIComponent(fileId)}/url`),
  };
}

export type FilesApi = ReturnType<typeof filesApi>;
