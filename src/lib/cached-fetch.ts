import { ApiError } from "@/api/client";
import { readCache, scopedKey, writeCache } from "@/lib/offline-cache";

export function readScoped<T>(userId: string, workspaceId: string, name: string): T | null {
  return readCache<T>(scopedKey(userId, workspaceId, name));
}

export function writeScoped(userId: string, workspaceId: string, name: string, value: unknown): void {
  writeCache(scopedKey(userId, workspaceId, name), value);
}

/**
 * Fetches and remembers a workspace list. Offline it returns the last copy saved on this device, so forms that need
 * an account or category still work without a connection.
 */
export async function fetchScoped<T>(
  userId: string,
  workspaceId: string,
  name: string,
  fetcher: () => Promise<T>,
): Promise<{ data: T | null; offline: boolean }> {
  const key = scopedKey(userId, workspaceId, name);
  try {
    const data = await fetcher();
    writeCache(key, data);
    return { data, offline: false };
  } catch (caught) {
    const offline = caught instanceof ApiError && caught.status === 0;
    return { data: readCache<T>(key), offline };
  }
}
