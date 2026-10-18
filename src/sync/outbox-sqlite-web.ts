import type { OutboxStore } from "@/sync/outbox";
import { localOutbox } from "@/sync/outbox-local";

const stores = new Map<string, OutboxStore>();

function storage() {
  return {
    getItem: (key: string) => {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string) => {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        /* private mode */
      }
    },
  };
}

export async function sqliteOutbox(userId: string, _dir: string): Promise<OutboxStore> {
  const existing = stores.get(userId);
  if (existing) return existing;
  const created = localOutbox(userId, storage());
  stores.set(userId, created);
  return created;
}
