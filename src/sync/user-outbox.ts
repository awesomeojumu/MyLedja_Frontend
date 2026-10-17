import { memoryOutbox, type OutboxStore } from "@/sync/outbox";

const memory = new Map<string, OutboxStore>();

export function outboxForUser(userId: string): OutboxStore {
  const existing = memory.get(userId);
  if (existing) return existing;
  const created = memoryOutbox();
  memory.set(userId, created);
  return created;
}
