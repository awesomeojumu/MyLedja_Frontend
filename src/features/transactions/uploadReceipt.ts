import { filesApi, uriToBase64 } from '@/api/files';
import type { ApiClient } from '@/api/client';

/** Pick path → upload private file → return server fileId (falls back to local URI offline). */
export async function uploadReceiptFromUri(
  client: ApiClient,
  workspaceId: string | undefined,
  uri: string,
): Promise<string> {
  if (!workspaceId) return uri;
  try {
    const { contentBase64, contentType } = await uriToBase64(uri);
    const uploaded = await filesApi(client).uploadFile(workspaceId, {
      contentBase64,
      contentType,
      kind: 'receipt',
    });
    return uploaded.fileId;
  } catch {
    return uri;
  }
}
