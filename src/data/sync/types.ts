/** TECH-SPEC 9.1. Payload amounts are strings of minor units, so JSON never loses precision. */
export type Operation = {
  operationId: string;
  type: string;
  payload: Record<string, unknown>;
  /** The version of the record this change was made against; absent for new records. */
  baseVersion?: number;
  createdAt: string;
  schemaVersion: number;
  deviceId: string;
};

export type QueuedOperation = Operation & {
  attempts: number;
  nextAttemptAt: number;
  state: 'queued' | 'rejected';
  error?: string;
};

export type LocalRecord = {
  id: string;
  collection: string;
  version: number;
  data: Record<string, unknown>;
};

export type OperationResult =
  | { operationId: string; status: 'applied' | 'duplicate'; record?: LocalRecord }
  | { operationId: string; status: 'conflict'; record: LocalRecord }
  | { operationId: string; status: 'rejected'; error: string };

export type Change =
  | { seq: number; op: 'upsert'; record: LocalRecord }
  | { seq: number; op: 'tombstone'; collection: string; id: string };

export type ChangesPage = { changes: Change[]; lastSeq: number; hasMore: boolean; reset?: boolean };

/** What the engine needs from the server; the real one is `/sync/operations` and `/changes`. */
export interface SyncTransport {
  postOperations(operations: Operation[]): Promise<OperationResult[]>;
  getChanges(since: number): Promise<ChangesPage>;
}

/** Shown to the person: "This transaction was already changed on another device", with both versions. */
export type Conflict = {
  operation: Operation;
  server: LocalRecord;
  at: string;
};
