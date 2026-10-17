import initSqlJs from "sql.js";
import { assertRowUser } from "@/database/sqlite-partition";
import type { OutboxRecord, OutboxStore, SyncStatus } from "@/sync/outbox";

export type SqlJsDb = {
  run(sql: string, params?: unknown[]): void;
  exec(sql: string, params?: unknown[]): { columns: string[]; values: unknown[][] }[];
  export(): Uint8Array;
};

export type SqlJsEngine = { Database: new (data?: Uint8Array) => SqlJsDb };

export type FileIo = {
  read(path: string): Uint8Array | null;
  write(path: string, data: Uint8Array): void;
};

let engine: SqlJsEngine | null = null;

export async function loadSql(io: FileIo, wasmPath?: string): Promise<SqlJsEngine> {
  if (engine) return engine;
  const wasm = wasmPath ? io.read(wasmPath) ?? undefined : undefined;
  engine = await initSqlJs(wasm ? { wasmBinary: wasm } : undefined);
  return engine;
}

function persistDb(db: SqlJsDb, file: string, io: FileIo): void {
  io.write(file, db.export());
}

function readRow(row: Record<string, unknown>): OutboxRecord {
  return {
    operationId: String(row.operationId),
    userId: String(row.userId),
    workspaceId: String(row.workspaceId),
    entityType: "transaction",
    entityId: String(row.entityId),
    operationType: "create",
    payload: JSON.parse(String(row.payload)) as Record<string, unknown>,
    syncStatus: String(row.syncStatus) as SyncStatus,
    attemptCount: Number(row.attemptCount),
  };
}

export async function openSqliteOutbox(userId: string, file: string, io: FileIo, wasmPath?: string): Promise<OutboxStore> {
  const SQL = await loadSql(io, wasmPath);
  const existing = io.read(file);
  const db = existing ? new SQL.Database(existing) : new SQL.Database();
  db.run(`CREATE TABLE IF NOT EXISTS outbox (
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
  persistDb(db, file, io);

  return {
    save: (record) => {
      assertRowUser(userId, record.userId);
      db.run(`INSERT OR REPLACE INTO outbox VALUES (?,?,?,?,?,?,?,?,?)`, [
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
      persistDb(db, file, io);
    },
    list: (listUserId) => {
      if (listUserId !== userId) return [];
      const result = db.exec("SELECT * FROM outbox");
      if (!result[0]) return [];
      return result[0].values.map((values) => {
        const row: Record<string, unknown> = {};
        result[0].columns.forEach((col, i) => {
          row[col] = values[i];
        });
        return readRow(row);
      });
    },
    mark: (operationId, syncStatus) => {
      const current = db.exec("SELECT * FROM outbox WHERE operationId = ?", [operationId]);
      if (!current[0]?.values[0]) return;
      const attempt = Number(current[0].values[0][current[0].columns.indexOf("attemptCount")]) + 1;
      db.run("UPDATE outbox SET syncStatus = ?, attemptCount = ? WHERE operationId = ?", [
        syncStatus,
        attempt,
        operationId,
      ]);
      persistDb(db, file, io);
    },
  };
}
