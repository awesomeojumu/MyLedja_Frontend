import type { Snapshot } from '@/data/workspace/repository';
import { formatNaira } from '@/money';

/** P26-04: every posted money event as CSV rows. */
export function exportTransactionsCsv(snapshot: Snapshot): string {
  const payees = new Map(snapshot.payees.map((p) => [p.id, p.name]));
  const categories = new Map(snapshot.categories.map((c) => [c.id, c.name]));
  const accounts = new Map(snapshot.accounts.map((a) => [a.id, a.name]));
  const header = ['Date', 'Type', 'Payee', 'Category', 'Account', 'Amount', 'Notes'];
  const lines = [header.join(',')];
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type === 'opening_balance') continue;
    const accountIds = new Set(snapshot.accounts.map((a) => a.id));
    const money = e.lines.find((l) => accountIds.has(l.ledgerAccountId));
    const catLine = e.lines.find((l) => !accountIds.has(l.ledgerAccountId));
    const amount = money?.amountMinor ?? 0n;
    const row = [
      e.date,
      e.type,
      e.payeeId ? payees.get(e.payeeId) ?? '' : '',
      catLine ? categories.get(catLine.ledgerAccountId) ?? '' : '',
      money ? accounts.get(money.ledgerAccountId) ?? '' : '',
      formatNaira(amount, { signed: e.type !== 'transfer' }).replace(/,/g, ''),
      (e.notes ?? '').replace(/"/g, '""'),
    ];
    lines.push(row.map((c) => (c.includes(',') || c.includes('"') ? `"${c}"` : c)).join(','));
  }
  return lines.join('\n');
}
