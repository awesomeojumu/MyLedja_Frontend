import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertRowUser, sqlitePathForUser } from "@/database/sqlite-partition";
import type { OutboxRecord, OutboxStore, SyncStatus } from "@/sync/outbox";

export function fileOutbox(userId: string, dir: string): OutboxStore {
  const file = join(dir, sqlitePathForUser(userId).replace(/\.db$/, ".outbox.json"));
  const load = (): Map<string, OutboxRecord> => {
    if (!existsSync(file)) return new Map();
    const raw = JSON.parse(readFileSync(file, "utf8")) as [string, OutboxRecord][];
    return new Map(raw);
  };
  const persist = (rows: Map<string, OutboxRecord>) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify([...rows.entries()]));
  };
  return {
    save: (record) => {
      assertRowUser(userId, record.userId);
      const rows = load();
      rows.set(record.operationId, { ...record });
      persist(rows);
    },
    list: (listUserId) => {
      if (listUserId !== userId) return [];
      return [...load().values()].map((row) => ({ ...row }));
    },
    mark: (operationId, syncStatus: SyncStatus) => {
      const rows = load();
      const current = rows.get(operationId);
      if (current) {
        rows.set(operationId, { ...current, syncStatus, attemptCount: current.attemptCount + 1 });
        persist(rows);
      }
    },
  };
}
