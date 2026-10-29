import type { WorkspaceRepository } from '@/data/workspace/repository';

/** Bulk change pay-from account via correction (DESIGN #20 / PU-20). Skips reconciled. */
export async function bulkSetAccount(repo: WorkspaceRepository, eventIds: string[], accountId: string) {
  let skippedReconciled = 0;
  for (const id of eventIds) {
    const snapshot = await repo.load();
    const event = snapshot.events.find((e) => e.id === id);
    if (!event || event.status !== 'posted') continue;
    if (event.reconciledBy) {
      skippedReconciled += 1;
      continue;
    }
    if (event.type !== 'expense' && event.type !== 'income') continue;
    const accountIds = new Set(snapshot.accounts.map((a) => a.id));
    const money = event.lines.find((l) => accountIds.has(l.ledgerAccountId));
    const parts = event.lines.filter((l) => !accountIds.has(l.ledgerAccountId));
    if (!money) continue;
    const amount = parts.reduce((s, l) => s + (l.amountMinor < 0n ? -l.amountMinor : l.amountMinor), 0n);
    if (event.type === 'expense') {
      const r = await repo.correctTransaction(id, {
        kind: 'expense',
        accountId,
        parts: parts.map((p) => ({ categoryId: p.ledgerAccountId, amount: p.amountMinor })),
        date: event.date,
        notes: event.notes,
      });
      if (!r.ok) return r;
    } else {
      const categoryId = parts[0]?.ledgerAccountId;
      if (!categoryId) continue;
      const r = await repo.correctTransaction(id, {
        kind: 'income',
        accountId,
        categoryId,
        amount,
        date: event.date,
        notes: event.notes,
      });
      if (!r.ok) return r;
    }
  }
  return { ok: true as const, value: { skippedReconciled } };
}
