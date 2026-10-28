import type { Snapshot, TransactionInput, TxEvent } from '@/data/workspace/repository';

/** Build add input from an existing posted movement (panel Duplicate, DESIGN #18 footer). */
export function duplicateInput(snapshot: Snapshot, event: TxEvent): TransactionInput | null {
  if (event.status !== 'posted' || event.type === 'reversal') return null;
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  const money = event.lines.filter((l) => accountIds.has(l.ledgerAccountId));
  const parts = event.lines.filter((l) => !accountIds.has(l.ledgerAccountId));
  const payee = event.payeeId ? snapshot.payees.find((p) => p.id === event.payeeId)?.name : undefined;

  if (event.type === 'transfer') {
    const from = money.find((l) => l.amountMinor < 0n)?.ledgerAccountId;
    const to = money.find((l) => l.amountMinor > 0n)?.ledgerAccountId;
    const amount = money.find((l) => l.amountMinor > 0n)?.amountMinor;
    if (!from || !to || !amount) return null;
    return { kind: 'transfer', fromId: from, toId: to, amount, date: event.date, notes: event.notes };
  }
  if (event.type === 'income') {
    const accountId = money[0]?.ledgerAccountId;
    const categoryId = parts[0]?.ledgerAccountId;
    const amount = parts.reduce((s, l) => s + (l.amountMinor < 0n ? -l.amountMinor : l.amountMinor), 0n);
    if (!accountId || !categoryId || amount <= 0n) return null;
    return { kind: 'income', accountId, categoryId, amount, date: event.date, payeeName: payee, notes: event.notes };
  }
  if (event.type === 'expense') {
    const accountId = money.find((l) => l.amountMinor < 0n)?.ledgerAccountId ?? money[0]?.ledgerAccountId;
    if (!accountId) return null;
    const expenseParts = parts.map((p) => ({ categoryId: p.ledgerAccountId, amount: p.amountMinor }));
    if (expenseParts.length === 0) return null;
    return { kind: 'expense', accountId, parts: expenseParts, date: event.date, payeeName: payee, notes: event.notes };
  }
  return null;
}
