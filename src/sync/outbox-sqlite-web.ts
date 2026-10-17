import { memoryOutbox, type OutboxStore } from "@/sync/outbox";

const stores = new Map<string, OutboxStore>();

export async function sqliteOutbox(userId: string, _dir: string): Promise<OutboxStore> {
  const existing = stores.get(userId);
  if (existing) return existing;
  const created = memoryOutbox();
  stores.set(userId, created);
  return created;
}
