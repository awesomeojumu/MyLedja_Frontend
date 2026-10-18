/**
 * Last good copy of server data, kept per user and workspace so screens can show real records offline instead of
 * an empty list or ₦0. Pure core with an injectable key-value backend; durable-kv.ts wires the device store.
 */
export interface KeyValue {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function memoryKeyValue(): KeyValue {
  const rows = new Map<string, string>();
  return {
    get: (key) => rows.get(key) ?? null,
    set: (key, value) => {
      rows.set(key, value);
    },
    remove: (key) => {
      rows.delete(key);
    },
  };
}

let backend: KeyValue = memoryKeyValue();

export function setKeyValueBackend(next: KeyValue): void {
  backend = next;
}

export function scopedKey(userId: string, workspaceId: string, name: string): string {
  return `myledja.cache.${userId}.${workspaceId}.${name}`;
}

export function readCache<T>(key: string): T | null {
  try {
    const raw = backend.get(key);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeCache(key: string, value: unknown): void {
  try {
    backend.set(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: the screen still has the live copy */
  }
}

export function removeCache(key: string): void {
  try {
    backend.remove(key);
  } catch {
    /* nothing to remove */
  }
}
