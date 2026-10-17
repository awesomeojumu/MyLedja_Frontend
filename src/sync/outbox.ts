export type SyncStatus = "saved_on_device" | "syncing" | "synced" | "failed_temporarily" | "needs_attention";

export interface OutboxRecord {
  operationId: string;
  userId: string;
  workspaceId: string;
  entityType: "transaction";
  entityId: string;
  operationType: "create";
  payload: unknown;
  syncStatus: SyncStatus;
  attemptCount: number;
}

export interface OutboxStore {
  save(record: OutboxRecord): void;
  list(userId: string): OutboxRecord[];
  mark(operationId: string, syncStatus: SyncStatus): void;
}

export function memoryOutbox(): OutboxStore {
  const rows = new Map<string, OutboxRecord>();
  return {
    save: (record) => {
      rows.set(record.operationId, { ...record });
    },
    list: (userId) => [...rows.values()].filter((row) => row.userId === userId).map((row) => ({ ...row })),
    mark: (operationId, syncStatus) => {
      const current = rows.get(operationId);
      if (current) rows.set(operationId, { ...current, syncStatus, attemptCount: current.attemptCount + 1 });
    },
  };
}

export function persistExpense(store: OutboxStore, record: OutboxRecord): void {
  store.save({ ...record, syncStatus: "saved_on_device", attemptCount: 0 });
}

export async function drainOnce(
  store: OutboxStore,
  userId: string,
  post: (payload: unknown, operationId: string) => Promise<boolean>,
): Promise<number> {
  const pending = store.list(userId).filter((row) => row.syncStatus !== "synced");
  let sent = 0;
  for (const row of pending) {
    store.mark(row.operationId, "syncing");
    const ok = await post(row.payload, row.operationId);
    store.mark(row.operationId, ok ? "synced" : "failed_temporarily");
    if (ok) sent += 1;
  }
  return sent;
}

export function pendingBadge(status: SyncStatus): boolean {
  return status !== "synced";
}
