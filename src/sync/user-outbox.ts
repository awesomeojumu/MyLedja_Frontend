import { memoryOutbox, type OutboxStore } from "@/sync/outbox";

const memory = new Map<string, OutboxStore>();
const sqlite = new Map<string, OutboxStore>();
const sqliteDir = process.env.MYLEDJA_SQLITE_DIR ?? ".data/sqlite";

function appSqlite(): boolean {
  const nav = typeof navigator !== "undefined" ? (navigator as { product?: string }).product : "";
  return nav === "ReactNative" || (typeof window !== "undefined" && typeof WebAssembly !== "undefined");
}

export function outboxForUser(userId: string): OutboxStore {
  const durable = sqlite.get(userId);
  if (durable) return durable;
  const existing = memory.get(userId);
  if (existing) return existing;
  const created = memoryOutbox();
  memory.set(userId, created);
  if (appSqlite()) {
    void import("@/sync/outbox-sqlite").then(({ sqliteOutbox }) =>
      sqliteOutbox(userId, sqliteDir).then((store) => {
        for (const row of created.list(userId)) store.save(row);
        sqlite.set(userId, store);
      }),
    );
  }
  return created;
}

export async function primeUserOutbox(userId: string): Promise<OutboxStore> {
  const existing = sqlite.get(userId);
  if (existing) return existing;
  if (!appSqlite()) {
    const store = memoryOutbox();
    sqlite.set(userId, store);
    return store;
  }
  const { sqliteOutbox } = await import("@/sync/outbox-sqlite");
  const store = await sqliteOutbox(userId, sqliteDir);
  sqlite.set(userId, store);
  return store;
}
