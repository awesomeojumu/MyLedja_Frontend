import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sqlitePathForUser } from "@/database/sqlite-partition";
import { openSqliteOutbox, type FileIo } from "@/sync/outbox-sqlite-core";
import type { OutboxStore } from "@/sync/outbox";

function nodeIo(): FileIo {
  return {
    read: (file) => (existsSync(file) ? new Uint8Array(readFileSync(file)) : null),
    write: (file, data) => {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, data);
    },
  };
}

export async function sqliteOutbox(userId: string, dir: string): Promise<OutboxStore> {
  const io = nodeIo();
  const wasm = join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm");
  return openSqliteOutbox(userId, join(dir, sqlitePathForUser(userId)), io, wasm);
}
