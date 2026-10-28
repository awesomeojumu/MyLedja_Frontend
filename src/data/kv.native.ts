import * as SQLite from 'expo-sqlite';

import type { KeyValue } from './kv.shared';

export { MemoryKeyValue, type KeyValue } from './kv.shared';

/** Native store on SQLite. Encryption (SQLCipher) waits on prototype T0.3. */
export function openKeyValue(name = 'myledja'): KeyValue {
  const db = SQLite.openDatabaseSync(`${name}.db`);
  db.execSync('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL)');
  return {
    async get(key) {
      const row = await db.getFirstAsync<{ v: string }>('SELECT v FROM kv WHERE k = ?', key);
      return row?.v ?? null;
    },
    async set(entries) {
      await db.withTransactionAsync(async () => {
        for (const [k, v] of entries) await db.runAsync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', k, v);
      });
    },
    async remove(keys) {
      await db.withTransactionAsync(async () => {
        for (const k of keys) await db.runAsync('DELETE FROM kv WHERE k = ?', k);
      });
    },
    async keys(prefix) {
      const rows = await db.getAllAsync<{ k: string }>("SELECT k FROM kv WHERE k LIKE ? ESCAPE '\\'", `${prefix.replace(/[%_\\]/g, '\\$&')}%`);
      return rows.map((r) => r.k);
    },
  };
}
