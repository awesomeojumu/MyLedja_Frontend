import type { ApiClient } from './client';

export type UploadedFile = { fileId: string; bytes: number; resourceType: 'raw' | 'image' };
export type FileViewUrl = { url: string; expiresAt: string; fileId: string };

/** Receipt / attachment files (TECH-SPEC §8). Hand-written until `api:sync` after BE merge. */
export function filesApi(client: ApiClient) {
  return {
    uploadFile: (
      workspaceId: string,
      body: { contentBase64: string; contentType?: string; kind?: 'receipt' | 'statement' | 'other' },
    ) =>
      client.request<UploadedFile>('POST', `/v1/workspaces/${workspaceId}/files`, {
        contentBase64: body.contentBase64,
        contentType: body.contentType ?? 'image/jpeg',
        kind: body.kind ?? 'receipt',
      }),
    viewUrl: (workspaceId: string, fileId: string) =>
      client.request<FileViewUrl>(
        'GET',
        `/v1/workspaces/${workspaceId}/files/${encodeURIComponent(fileId)}/view-url`,
      ),
  };
}

export type FilesApi = ReturnType<typeof filesApi>;

/** Read a local file/blob URI into base64 for upload (web + RN fetch). */
export async function uriToBase64(uri: string): Promise<{ contentBase64: string; contentType: string }> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const contentType = blob.type || 'image/jpeg';
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const contentBase64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return { contentBase64, contentType };
}
