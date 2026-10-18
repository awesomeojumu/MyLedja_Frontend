export interface HomePendingRow {
  id: string;
  description: string;
  amount: string;
}

export interface HomePendingModel {
  offline: boolean;
  pendingRows: HomePendingRow[];
  postedSpent: string;
  waitingLine: string | null;
}

export function homePendingModel(input: {
  sessionOffline: boolean;
  queued: { operationId: string; payload: { description?: string; amount?: string } }[];
  postedSpent: string;
}): HomePendingModel {
  const pendingRows = input.queued.map((row) => ({
    id: row.operationId,
    description: row.payload.description ?? "Saved on this phone",
    amount: row.payload.amount ?? "0.00",
  }));
  const waiting = pendingRows.reduce((sum, row) => sum + (Number.parseFloat(row.amount) || 0), 0);
  return {
    offline: input.sessionOffline || pendingRows.length > 0,
    pendingRows,
    postedSpent: input.postedSpent,
    waitingLine: waiting > 0 ? `₦${waiting.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} waiting to sync` : null,
  };
}
