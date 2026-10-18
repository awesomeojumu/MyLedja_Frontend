import type { OutboxRecord, OutboxStore, SyncStatus } from "@/sync/outbox";

export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function outboxStorageKey(userId: string): string {
  return `myledja.outbox.${userId}`;
}

/**
 * The web build's outbox: one JSON list per user in browser storage, written synchronously on every change so a
 * record saved offline survives a reload or a closed tab. Phones use SQLite (outbox-sqlite.ts) instead.
 */
export function localOutbox(userId: string, storage: StringStorage): OutboxStore {
  const key = outboxStorageKey(userId);
  const read = (): OutboxRecord[] => {
    try {
      const raw = storage.getItem(key);
      return raw ? (JSON.parse(raw) as OutboxRecord[]) : [];
    } catch {
      return [];
    }
  };
  const write = (rows: OutboxRecord[]) => storage.setItem(key, JSON.stringify(rows));
  return {
    save: (record) => {
      if (record.userId !== userId) throw new Error("Outbox row belongs to another user.");
      const rows = read().filter((row) => row.operationId !== record.operationId);
      rows.push({ ...record });
      write(rows);
    },
    list: (listUserId) => (listUserId === userId ? read() : []),
    mark: (operationId: string, syncStatus: SyncStatus) => {
      write(
        read().map((row) =>
          row.operationId === operationId ? { ...row, syncStatus, attemptCount: row.attemptCount + 1 } : row,
        ),
      );
    },
  };
}
