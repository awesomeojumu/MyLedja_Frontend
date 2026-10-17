declare module "sql.js" {
  type SqlJsDb = {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string, params?: unknown[]): { columns: string[]; values: unknown[][] }[];
    export(): Uint8Array;
  };

  type SqlJsEngine = { Database: new (data?: Uint8Array) => SqlJsDb };

  export default function initSqlJs(config?: { wasmBinary?: Uint8Array }): Promise<SqlJsEngine>;
}
