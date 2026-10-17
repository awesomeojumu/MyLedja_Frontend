import { openDatabaseSync } from "expo-sqlite";
import { assertRowUser, sqlitePathForUser } from "@/database/sqlite-partition";
import type { OutboxRecord, OutboxStore, SyncStatus } from "@/sync/outbox";

type OutboxRow = {
  operationId: string;
  userId: string;
  workspaceId: string;
  payload: string;
  syncStatus: string;
  attemptCount: number;
  entityId: string;
};

function readRow(row: OutboxRow): OutboxRecord {
  return {
    operationId: String(row.operationId),
    userId: String(row.userId),
    workspaceId: String(row.workspaceId),
    entityType: "transaction",
    entityId: String(row.entityId),
    operationType: "create",
    payload: JSON.parse(String(row.payload)) as unknown,
    syncStatus: String(row.syncStatus) as SyncStatus,
    attemptCount: Number(row.attemptCount),
  };
}

export async function sqliteOutbox(userId: string, _dir: string): Promise<OutboxStore> {
  const db = openDatabaseSync(sqlitePathForUser(userId));
  db.execSync(`CREATE TABLE IF NOT EXISTS outbox (
    operationId TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    workspaceId TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    operationType TEXT NOT NULL,
    payload TEXT NOT NULL,
    syncStatus TEXT NOT NULL,
    attemptCount INTEGER NOT NULL
  )`);

  return {
    save: (record) => {
      assertRowUser(userId, record.userId);
      db.runSync(`INSERT OR REPLACE INTO outbox VALUES (?,?,?,?,?,?,?,?,?)`, [
        record.operationId,
        record.userId,
        record.workspaceId,
        record.entityType,
        record.entityId,
        record.operationType,
        JSON.stringify(record.payload),
        record.syncStatus,
        record.attemptCount,
      ]);
    },
    list: (listUserId) => {
      if (listUserId !== userId) return [];
      return db.getAllSync<OutboxRow>("SELECT * FROM outbox").map(readRow);
    },
    mark: (operationId, syncStatus) => {
      const current = db.getAllSync<OutboxRow>("SELECT * FROM outbox WHERE operationId = ?", [operationId])[0];
      if (!current) return;
      db.runSync("UPDATE outbox SET syncStatus = ?, attemptCount = ? WHERE operationId = ?", [
        syncStatus,
        Number(current.attemptCount) + 1,
        operationId,
      ]);
    },
  };
}
