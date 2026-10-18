import { ApiError } from "@/api/client";
import { newId } from "@/lib/ids";
import { persistExpense, type OutboxStore } from "@/sync/outbox";

export type SaveOutcome = "synced" | "saved_on_device";

export type PostTransaction = (workspaceId: string, payload: unknown, operationId: string) => Promise<unknown>;

const running = new Set<string>();

/**
 * Sends every unsent record once. The server dedupes on operationId, so a retry after a dropped response never
 * creates a second record (TC-11). A network failure leaves the record queued; any other failure needs the user.
 */
export async function syncOutbox(store: OutboxStore, userId: string, post: PostTransaction): Promise<number> {
  if (running.has(userId)) return 0;
  running.add(userId);
  let sent = 0;
  try {
    const pending = store.list(userId).filter((row) => row.syncStatus !== "synced" && row.syncStatus !== "needs_attention");
    for (const row of pending) {
      store.mark(row.operationId, "syncing");
      try {
        await post(row.workspaceId, row.payload, row.operationId);
        store.mark(row.operationId, "synced");
        sent += 1;
      } catch (caught) {
        const network = caught instanceof ApiError && caught.status === 0;
        store.mark(row.operationId, network ? "failed_temporarily" : "needs_attention");
        if (network) break;
      }
    }
  } finally {
    running.delete(userId);
  }
  return sent;
}

/** Writes the record to the device first, then tries to send it. The user's entry is never lost to a bad signal. */
export async function saveTransaction(
  store: OutboxStore,
  input: { userId: string; workspaceId: string; payload: Record<string, unknown> },
  post: PostTransaction,
): Promise<SaveOutcome> {
  const operationId = newId();
  persistExpense(store, {
    operationId,
    userId: input.userId,
    workspaceId: input.workspaceId,
    entityType: "transaction",
    entityId: operationId,
    operationType: "create",
    payload: input.payload,
    syncStatus: "saved_on_device",
    attemptCount: 0,
  });
  await syncOutbox(store, input.userId, post);
  const row = store.list(input.userId).find((item) => item.operationId === operationId);
  if (row?.syncStatus === "needs_attention") {
    throw new Error("We couldn't save this. Check the amount and account, then try again.");
  }
  return row?.syncStatus === "synced" ? "synced" : "saved_on_device";
}

export function savedToast(kind: string, outcome: SaveOutcome): string {
  const noun = kind === "income" ? "Income" : kind === "transfer" ? "Transfer" : "Expense";
  return outcome === "synced" ? `${noun} saved` : `${noun} saved on this phone. It will sync when you're back online.`;
}
