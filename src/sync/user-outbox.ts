import { memoryOutbox, type OutboxStore } from "@/sync/outbox";
import { localOutbox, type StringStorage } from "@/sync/outbox-local";

const memory = new Map<string, OutboxStore>();
const sqlite = new Map<string, OutboxStore>();
const sqliteDir = process.env.MYLEDJA_SQLITE_DIR ?? ".data/sqlite";

/** Expo web: Platform.OS === "web". Avoid importing react-native here so unit tests stay Node-only. */
function isWeb(): boolean {
  const os = process.env.EXPO_OS ?? process.env.EXPO_PLATFORM;
  return os === "web" || typeof document !== "undefined";
}

function nativeSqliteOn(): boolean {
  const os = process.env.EXPO_OS ?? process.env.EXPO_PLATFORM;
  return os === "ios" || os === "android";
}

/** The web build keeps its outbox in localStorage: expo-sqlite's browser build here does not survive a reload. */
function webStorage(): StringStorage | null {
  if (!isWeb()) return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function outboxForUser(userId: string): OutboxStore {
  const durable = sqlite.get(userId);
  if (durable) return durable;
  const storage = webStorage();
  if (storage) {
    const store = localOutbox(userId, storage);
    sqlite.set(userId, store);
    return store;
  }
  const existing = memory.get(userId);
  if (existing) return existing;
  const created = memoryOutbox();
  memory.set(userId, created);
  if (nativeSqliteOn()) {
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
  const storage = webStorage();
  if (storage) {
    const store = localOutbox(userId, storage);
    sqlite.set(userId, store);
    return store;
  }
  if (!nativeSqliteOn()) {
    const store = memoryOutbox();
    sqlite.set(userId, store);
    return store;
  }
  const { sqliteOutbox } = await import("@/sync/outbox-sqlite");
  const store = await sqliteOutbox(userId, sqliteDir);
  sqlite.set(userId, store);
  return store;
}
